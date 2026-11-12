// Shared helpers for the README media: start ShopLite, add a caption bar to a page, and record
// screenshots into an animated GIF (pure JavaScript, no ffmpeg needed).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const MEDIA = join(ROOT, 'docs', 'media');

/** Starts ShopLite on a fresh database. Chaos injection is enabled for the chaos demo. */
export async function startApp(port) {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'shoplite-media-')), 'media.db');
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: join(ROOT, 'app'),
    stdio: 'ignore',
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath, CHAOS_ENABLED: 'true', LOGIN_RATE_LIMIT: '10000' },
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    base,
    stop: () => child.kill('SIGTERM'),
    async chaos(fault) {
      await fetch(`${base}/__chaos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latencyMs: 0, errorRate: 0, pathPrefix: '/api/', ...fault }),
      });
    },
  };
}

const TONES = { info: '#1f5f3f', test: '#1a56c4', warn: '#a3261c', ok: '#1f7a4a' };

/** Shows a caption bar at the bottom of the page (the page must allow inline styles: bypassCSP). */
export async function caption(page, text, tone = 'info') {
  await page.evaluate(
    ({ text, color }) => {
      let bar = document.getElementById('__caption');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = '__caption';
        Object.assign(bar.style, {
          position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '99999',
          padding: '14px 22px', font: '600 19px/1.35 system-ui, -apple-system, sans-serif',
          color: '#fff', boxShadow: '0 -4px 16px rgba(0,0,0,.18)',
        });
        document.body.append(bar);
      }
      bar.style.background = color;
      bar.textContent = text;
    },
    { text, color: TONES[tone] ?? tone },
  );
}

export async function removeCaption(page) {
  await page.evaluate(() => document.getElementById('__caption')?.remove());
}

/** Collects screenshots and writes them as an animated GIF. */
export class GifRecorder {
  frames = [];

  constructor(name, { width, height } = {}) {
    this.name = name;
    this.width = width;
    this.height = height;
  }

  /** Captures the page (or element) as one frame shown for `ms` milliseconds. */
  async snap(target, ms = 900, options = {}) {
    const png = PNG.sync.read(await target.screenshot({ animations: 'disabled', caret: 'hide', ...options }));
    this.frames.push({ png, ms });
  }

  /** Makes the previous frame stay longer. */
  hold(ms) {
    this.frames.at(-1).ms += ms;
  }

  save() {
    const gif = GIFEncoder();
    const { width, height } = this.frames[0].png;
    for (const { png, ms } of this.frames) {
      if (png.width !== width || png.height !== height) throw new Error(`${this.name}: frames differ in size`);
      const palette = quantize(png.data, 256);
      gif.writeFrame(applyPalette(png.data, palette), width, height, { palette, delay: ms });
    }
    gif.finish();
    // For reviewing: PREVIEW_DIR=/some/dir writes the first, middle and last frame as PNGs.
    if (process.env.PREVIEW_DIR) {
      const picks = [0, Math.floor(this.frames.length / 2), this.frames.length - 1];
      for (const i of new Set(picks)) {
        writeFileSync(join(process.env.PREVIEW_DIR, `${this.name}-${i}.png`), PNG.sync.write(this.frames[i].png));
      }
    }
    const file = join(MEDIA, `${this.name}.gif`);
    writeFileSync(file, gif.bytes());
    console.log(`${this.name}.gif  ${this.frames.length} frames  ${(statSync(file).size / 1024).toFixed(0)} KB  ${width}x${height}`);
    return file;
  }
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** A blank page used to compose frames from HTML (phone frames, side-by-side images, charts). */
export async function stage(browser, size = { width: 1000, height: 620 }) {
  const page = await browser.newPage({ viewport: size });
  return {
    page,
    async show(html) {
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>
          *{box-sizing:border-box} body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;
          font-family:${FONT};background:#0f172a;color:#e2e8f0}
        </style></head><body>${html}</body></html>`,
      );
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    },
  };
}

export const dataUrl = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for a terminal window showing `lines` (strings, or {text, color}), with a title above it. */
export function terminal(title, subtitle, lines, { prompt } = {}) {
  const body = lines
    .map((l) => (typeof l === 'string' ? { text: l } : l))
    .map(({ text, color }) => `<div style="color:${color ?? '#cbd5e1'}">${escapeHtml(text) || '&nbsp;'}</div>`)
    .join('');
  return `
    <div style="padding:26px 34px 0">
      <div style="font:700 26px ${FONT};color:#f8fafc">${title}</div>
      <div style="font:400 17px ${FONT};color:#94a3b8;margin-top:6px">${subtitle}</div>
    </div>
    <div style="margin:18px 34px;border-radius:12px;background:#020617;border:1px solid #1e293b;height:${620 - 140}px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.4)">
      <div style="display:flex;gap:8px;padding:12px 14px;border-bottom:1px solid #1e293b">
        <span style="width:12px;height:12px;border-radius:50%;background:#ef4444"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#eab308"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#22c55e"></span>
        <span style="margin-left:10px;font:13px ui-monospace,Menlo,monospace;color:#64748b">${escapeHtml(prompt ?? '')}</span>
      </div>
      <div style="padding:12px 18px;font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre">${body}</div>
    </div>`;
}

export const alice = { email: 'alice@shoplite.test', password: 'Passw0rd!' };
export const VIEW = { width: 1000, height: 620 };

/** Draws a ring around the element a test is about to use, so viewers can follow along. */
export async function point(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => {
    document.querySelectorAll('[data-media-ring]').forEach((e) => { e.style.boxShadow = ''; e.removeAttribute('data-media-ring'); });
    el.setAttribute('data-media-ring', '');
    el.style.boxShadow = '0 0 0 4px #f5b301, 0 0 0 8px rgba(245,179,1,.35)';
  });
}

/** Types into a field a few characters per frame, so the GIF shows the typing. */
export async function typeInto(rec, page, locator, text, every = 4) {
  await point(locator);
  await locator.click();
  for (let i = 0; i < text.length; i += every) {
    await locator.fill(text.slice(0, i + every));
    await rec.snap(page, 90);
  }
}

/** Logs in through the API and stores the session in the page, like a returning customer. */
export async function signIn(page, base, user = alice) {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
  const { token, user: profile } = await res.json();
  await page.goto(`${base}/`);
  await page.evaluate(([t, u]) => { localStorage.setItem('shoplite.token', t); localStorage.setItem('shoplite.user', JSON.stringify(u)); }, [token, profile]);
}

/** Saves a still image of the page (or element) into docs/media. */
export async function savePng(target, name, options = {}) {
  const file = join(MEDIA, `${name}.png`);
  await target.screenshot({ path: file, animations: 'disabled', caret: 'hide', ...options });
  console.log(`${name}.png  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  return file;
}
