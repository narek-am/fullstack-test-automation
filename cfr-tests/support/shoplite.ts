import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', '..', 'app');

export type Fault = { latencyMs?: number; errorRate?: number; pathPrefix?: string };

/**
 * A real ShopLite process the experiments can break: inject latency or errors through the
 * opt-in chaos middleware (CHAOS_ENABLED), or stop and restart the whole server.
 * The SQLite file outlives restarts, like a database would; sessions (in memory) do not.
 */
export class ShopLiteServer {
  readonly baseURL: string;
  private readonly dbPath = join(mkdtempSync(join(tmpdir(), 'shoplite-chaos-')), 'chaos.db');
  private process?: ChildProcess;

  constructor(readonly port: number) {
    this.baseURL = `http://127.0.0.1:${port}`;
  }

  async start() {
    this.process = spawn(process.execPath, ['src/index.js'], {
      cwd: APP_DIR,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(this.port), DB_PATH: this.dbPath, CHAOS_ENABLED: 'true', LOGIN_RATE_LIMIT: '10000' },
    });
    for (let i = 0; i < 100; i += 1) {
      if (await this.isUp()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`ShopLite did not start on port ${this.port}`);
  }

  async stop() {
    const child = this.process;
    if (!child || child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
    });
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  async isUp() {
    try {
      return (await fetch(`${this.baseURL}/api/health`)).ok;
    } catch {
      return false;
    }
  }

  /** Turns on a fault for requests under `pathPrefix` (default: every /api/ route except health). */
  async inject(fault: Fault) {
    const res = await fetch(`${this.baseURL}/__chaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latencyMs: 0, errorRate: 0, pathPrefix: '/api/', ...fault }),
    });
    if (!res.ok) throw new Error(`could not inject fault: ${res.status}`);
  }

  /** Rollback: removes every injected fault. */
  async heal() {
    await this.inject({});
  }

  async api<T = any>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${this.baseURL}/api${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}`);
    return (res.status === 204 ? null : await res.json()) as T;
  }
}
