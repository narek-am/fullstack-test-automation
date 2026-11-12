// Load testing: a real Apache Bench run against ShopLite, drawn as an animated bar chart.
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GifRecorder, stage, ROOT } from '../lib.mjs';

const PERF = join(ROOT, 'performance-tests');
const LABELS = {
  'product-list': 'Product list',
  'search-sorted': 'Search',
  'product-detail': 'Product page',
  'home-page-html': 'Home page',
  'cart-auth': 'Shopping cart',
  login: 'Log in',
};

async function benchmark() {
  const app = spawn(process.execPath, ['scripts/start-app.mjs', '3400'], { cwd: PERF, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i += 1) {
      try { if ((await fetch('http://127.0.0.1:3400/api/health')).ok) break; } catch { /* starting */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const out = mkdtempSync(join(tmpdir(), 'ab-media-'));
    execFileSync('./ab/benchmark.sh', { cwd: PERF, env: { ...process.env, OUT: out }, stdio: 'ignore' });
    return readFileSync(join(out, 'summary.md'), 'utf8');
  } finally {
    app.kill('SIGTERM');
  }
}

export default async function load() {
  const rows = (await benchmark())
    .split('\n')
    .filter((l) => /^\| [a-z]/.test(l) && !l.startsWith('| Benchmark'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map(([, name, , , rps, , p95]) => ({ name: LABELS[name] ?? name, rps: Number(rps), p95: Number(p95) }));
  const max = Math.max(...rows.map((r) => r.rps));

  const browser = await chromium.launch();
  const { page, show } = await stage(browser);
  const rec = new GifRecorder('load-test');
  const chart = (progress, note) => `
    <div style="padding:26px 40px 0">
      <div style="font:700 26px system-ui;color:#f8fafc">⚡ Load test: how much traffic can the shop handle?</div>
      <div style="font:17px system-ui;color:#94a3b8;margin-top:6px">Thousands of requests, 20 at the same time, on a laptop. Each bar = requests answered per second.</div>
    </div>
    <div style="padding:22px 40px 0">
      ${rows.map((r) => `
        <div style="display:flex;align-items:center;margin:15px 0">
          <div style="width:150px;font:600 17px system-ui;color:#e2e8f0">${r.name}</div>
          <div style="flex:1;height:34px;background:#1e293b;border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${Math.max(0.6, (r.rps / max) * 100 * progress)}%;background:${r.name === 'Log in' ? '#f59e0b' : '#22c55e'};border-radius:6px"></div>
          </div>
          <div style="width:250px;text-align:right;font:600 17px system-ui;color:#f8fafc">${Math.round(r.rps * progress).toLocaleString('en-US')} /s
            <span style="color:#94a3b8;font-weight:400"> · ${progress === 1 ? `95% in ≤ ${r.p95} ms` : ''}</span></div>
        </div>`).join('')}
    </div>
    <div style="margin:18px 40px;padding:14px 18px;border-radius:10px;background:#1e293b;font:17px/1.45 system-ui;color:#e2e8f0;min-height:76px">${note}</div>`;

  for (const p of [0.05, 0.25, 0.5, 0.75, 1]) {
    await show(chart(p, 'Sending requests…'));
    await rec.snap(page, p === 1 ? 600 : 260);
  }
  await show(chart(1, '✔ All requests answered, none failed, every endpoint within its time limit.<br><span style="color:#fbbf24">Log in</span> is slower on purpose: passwords are hashed with scrypt so stolen data is hard to crack.'));
  await rec.snap(page, 4200);

  rec.save();
  await browser.close();
}
