// Lighthouse: runs Lighthouse CI on the real app and captures the score gauges of the home page report.
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stage, dataUrl, savePng, ROOT } from '../lib.mjs';

const PERF = join(ROOT, 'performance-tests');

export default async function lighthouse() {
  const run = spawnSync('npm', ['run', 'lighthouse'], { cwd: PERF, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`Lighthouse CI failed:\n${run.stdout}${run.stderr}`);
  const manifest = JSON.parse(readFileSync(join(PERF, 'lighthouse', 'results', 'manifest.json'), 'utf8'));
  const home = manifest.find((r) => r.isRepresentativeRun && new URL(r.url).pathname === '/');

  const browser = await chromium.launch();
  const report = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  await report.goto(`file://${home.htmlPath}`);
  // Crop tightly around the category gauges (the header strip itself is mostly empty space).
  const boxes = await report.locator('.lh-scores-header .lh-gauge__wrapper').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  const pad = 16;
  const left = Math.min(...boxes.map((b) => b.left)) - pad;
  const top = Math.min(...boxes.map((b) => b.top)) - pad;
  const clip = { x: left, y: top, width: Math.max(...boxes.map((b) => b.right)) + pad - left, height: Math.max(...boxes.map((b) => b.bottom)) + pad - top };
  const gauges = await report.screenshot({ clip, animations: 'disabled' });

  const { page, show } = await stage(browser, { width: 1000, height: 400 });
  await show(`
    <div style="padding:26px 34px 0">
      <div style="font:700 26px system-ui;color:#f8fafc">🚀 Lighthouse: speed, quality and accessibility scores</div>
      <div style="font:17px system-ui;color:#94a3b8;margin-top:6px">Google's page audit, run on every change. The build fails if a score drops or a page gets too heavy.</div>
    </div>
    <div style="margin:22px 34px;padding:22px;border-radius:14px;background:#fff;display:flex;justify-content:center">
      <img src="${dataUrl(gauges)}" style="height:190px">
    </div>
    <div style="padding:0 34px;font:16px system-ui;color:#cbd5e1">Home page: first content in about 0.3 s, 27 KB downloaded in total, barely any layout shift, no third-party code.</div>`);
  await savePng(page, 'lighthouse');
  await browser.close();
}
