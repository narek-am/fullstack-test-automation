// The same purchase on an emulated iPhone, shown inside a phone frame.
import { chromium, webkit, devices } from '@playwright/test';
import { startApp, GifRecorder, stage, dataUrl, signIn } from '../lib.mjs';

export default async function mobile() {
  const app = await startApp(3902);
  const phoneBrowser = await webkit.launch();
  const phone = await phoneBrowser.newPage({ ...devices['iPhone 14'] });
  const host = await chromium.launch();
  const { page: stagePage, show } = await stage(host);
  const rec = new GifRecorder('mobile-test');
  const steps = [];

  async function frame(step, ms) {
    if (step) steps.push(step);
    const shot = await phone.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    await show(`
      <div style="display:flex;align-items:center;height:100%;padding:0 60px;gap:56px">
        <div style="flex:none;padding:12px;border-radius:44px;background:#111827;box-shadow:0 0 0 2px #374151,0 20px 40px rgba(0,0,0,.5)">
          <img src="${dataUrl(shot)}" style="display:block;height:560px;border-radius:32px">
        </div>
        <div>
          <div style="font:700 28px system-ui;color:#f8fafc">📱 Mobile test on an iPhone 14</div>
          <div style="font:17px system-ui;color:#94a3b8;margin:8px 0 26px">The same shop on a phone screen, using taps instead of clicks</div>
          ${steps
            .map((s, i) => {
              const current = i === steps.length - 1 && !s.endsWith('✅');
              return `<div style="font:600 20px/1.4 system-ui;margin:12px 0;color:${current ? '#fbbf24' : '#86efac'}">${current ? '▶' : '✔'} ${s}</div>`;
            })
            .join('')}
        </div>
      </div>`);
    await rec.snap(stagePage, ms);
  }

  await signIn(phone, app.base);
  await phone.reload();
  await phone.getByTestId('product-card').first().waitFor();
  await frame('Products fit the screen in one column', 1700);
  await phone.getByRole('link', { name: 'Bug Hunter Mug' }).tap();
  await phone.getByTestId('product-detail').waitFor();
  await frame('Tap a product to open it', 1400);
  await phone.getByRole('button', { name: 'Add to cart' }).tap();
  await phone.getByRole('alert').waitFor();
  await frame('Tap “Add to cart”', 1500);
  await phone.getByRole('link', { name: /^Cart/ }).tap();
  await phone.getByTestId('cart-contents').waitFor();
  await frame('Open the cart: the table fits a phone', 1500);
  await phone.getByRole('button', { name: 'Place order' }).tap();
  await phone.getByTestId('orders-table').waitFor();
  await frame('Place the order', 1300);
  await frame('Passed on iPhone and Android ✅', 2800);

  rec.save();
  await phoneBrowser.close();
  await host.close();
  app.stop();
}
