// Visual regression: a real BackstopJS run after a deliberate style change, shown as
// approved screenshot -> new screenshot -> highlighted difference.
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GifRecorder, stage, dataUrl, ROOT } from '../lib.mjs';

const BACKSTOP = join(ROOT, 'visual-tests', 'backstop');
const CSS = join(ROOT, 'app', 'public', 'css', 'styles.css');
// The "accidental" change: a shared style makes the product page price much bigger.
const BREAKING_CSS = '\n.product-detail .price { font-size: 2.4rem; }\n';

async function runBackstop() {
  const app = spawn(process.execPath, ['scripts/start-app.mjs', '3301'], { cwd: BACKSTOP, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i += 1) {
      try { if ((await fetch('http://127.0.0.1:3301/api/health')).ok) break; } catch { /* starting */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      execFileSync('npx', ['backstop', 'test', '--config=backstop.config.js', '--filter=^Product details$'], { cwd: BACKSTOP, stdio: 'ignore' });
    } catch {
      /* expected: the comparison fails */
    }
  } finally {
    app.kill('SIGTERM');
  }
  const runs = join(BACKSTOP, 'backstop_data', 'bitmaps_test');
  const latest = readdirSync(runs).sort().pop();
  const { tests } = JSON.parse(readFileSync(join(runs, latest, 'report.json'), 'utf8'));
  const { pair } = tests.find((t) => t.pair.viewportLabel === 'desktop');
  const abs = (p) => join(runs, p); // report paths are relative to bitmaps_test/
  return {
    reference: readFileSync(abs(pair.reference)),
    test: readFileSync(abs(pair.test)),
    diff: readFileSync(abs(pair.diffImage)),
    percent: pair.diff.misMatchPercentage,
  };
}

export default async function visual() {
  const original = readFileSync(CSS, 'utf8');
  let shots;
  try {
    writeFileSync(CSS, original + BREAKING_CSS);
    shots = await runBackstop();
  } finally {
    writeFileSync(CSS, original); // always restore the real stylesheet
  }

  const browser = await chromium.launch();
  const { page, show } = await stage(browser);
  const rec = new GifRecorder('visual-test');
  // Screenshots are 1280 px wide; panels zoom into the product area (measured at 1280 x 900).
  const WIDE = { x: 130, y: 55, w: 1020, h: 470 };
  const NARROW = { x: 505, y: 152, w: 370, h: 320 };
  const panel = (img, label, color, crop, width) => {
    const scale = width / crop.w;
    return `
    <div style="flex:none;width:${width + 4}px">
      <div style="font:700 18px system-ui;color:${color};margin-bottom:10px">${label}</div>
      <div style="width:${width + 4}px;height:${Math.round(crop.h * scale) + 4}px;overflow:hidden;border-radius:10px;border:2px solid ${color};background:#fff">
        <img src="${dataUrl(img)}" style="display:block;width:${1280 * scale}px;margin:${-crop.y * scale}px 0 0 ${-crop.x * scale}px">
      </div>
    </div>`;
  };
  const header = (title, sub) => `
    <div style="padding:24px 34px 0"><div style="font:700 26px system-ui;color:#f8fafc">${title}</div>
    <div style="font:17px system-ui;color:#94a3b8;margin-top:6px">${sub}</div></div>`;
  const single = (img, label, color, title, sub) => `${header(title, sub)}
    <div style="display:flex;padding:18px 34px">${panel(img, label, color, WIDE, 928)}</div>`;

  await show(single(shots.reference, '✔ Approved screenshot (how the page should look)', '#86efac',
    '👁️ Visual test: does every page still look right?', 'Screenshots of every page are compared with approved ones, pixel by pixel'));
  await rec.snap(page, 2200);
  await show(single(shots.test, '📸 New screenshot after a code change', '#fbbf24',
    '👁️ Visual test: does every page still look right?', 'A style change was made somewhere else in the code…'));
  await rec.snap(page, 2200);
  await show(single(shots.diff, `❌ Difference found: ${shots.percent}% of the page changed (highlighted)`, '#f87171',
    '👁️ Visual test: does every page still look right?', 'The test highlights every changed pixel, so nobody has to spot it by eye'));
  await rec.snap(page, 2600);
  await show(`${header('👁️ Caught before users see it', 'The price on the product page grew by accident. The build fails until a person fixes it or approves the new look.')}
    <div style="display:flex;gap:18px;padding:18px 34px">
      ${panel(shots.reference, 'Approved', '#86efac', NARROW, 296)}${panel(shots.test, 'New', '#fbbf24', NARROW, 296)}${panel(shots.diff, 'Difference', '#f87171', NARROW, 296)}
    </div>`);
  await rec.snap(page, 3600);

  rec.save();
  await browser.close();
}
