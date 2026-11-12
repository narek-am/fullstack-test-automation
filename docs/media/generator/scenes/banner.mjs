// The banner at the top of the README.
import { chromium } from '@playwright/test';
import { stage, savePng } from '../lib.mjs';

const AREAS = [
  ['🖥️', 'UI'], ['🔌', 'API'], ['🤝', 'Contracts'], ['🗄️', 'Data'], ['👁️', 'Visual'], ['🔒', 'Security'],
  ['⚡', 'Load'], ['♿', 'Accessibility'], ['💥', 'Chaos'], ['🏛️', 'Architecture'], ['📱', 'Mobile'], ['🤖', 'CI/CD'],
];

export default async function banner() {
  const browser = await chromium.launch();
  const { page, show } = await stage(browser, { width: 1280, height: 400 });
  await show(`
    <div style="height:100%;padding:44px 56px;background:radial-gradient(circle at 85% 20%,#1f5f3f55,transparent 45%),radial-gradient(circle at 10% 90%,#1a56c455,transparent 40%),#0b1220">
      <div style="font:600 18px system-ui;letter-spacing:.14em;color:#4ade80;text-transform:uppercase">Test automation portfolio</div>
      <div style="font:800 56px/1.1 system-ui;color:#f8fafc;margin-top:12px">Full-Stack Test Automation</div>
      <div style="font:22px/1.4 system-ui;color:#94a3b8;margin-top:12px;max-width:1150px">
        One online shop, tested at every layer: from the code to the screen, from hackers to heavy traffic.
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:30px;max-width:1170px">
        ${AREAS.map(([icon, label]) => `<span style="padding:8px 14px;border-radius:999px;background:#16213a;border:1px solid #2a3a5c;font:600 17px system-ui;color:#e2e8f0">${icon} ${label}</span>`).join('')}
      </div>
    </div>`);
  await savePng(page, 'banner');
  await browser.close();
}
