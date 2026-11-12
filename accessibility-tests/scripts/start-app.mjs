// Starts ShopLite for the Pa11y scans: own port, own throwaway database.
// Usage: node scripts/start-app.mjs <port>
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const port = process.argv[2] ?? '3100';
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');
const dbDir = mkdtempSync(join(tmpdir(), `shoplite-a11y-${port}-`));

const child = spawn(process.execPath, ['src/index.js'], {
  cwd: appDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: port, DB_PATH: join(dbDir, 'test.db'), LOGIN_RATE_LIMIT: '10000' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
