// Chaos test: switch the product service off, check the shop handles it, switch it back on.
import { chromium } from '@playwright/test';
import { startApp, caption, GifRecorder, VIEW } from '../lib.mjs';

export default async function chaos() {
  const app = await startApp(3904);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEW, bypassCSP: true });
  const rec = new GifRecorder('chaos-test');

  await page.goto(`${app.base}/`);
  await page.getByTestId('product-card').first().waitFor();
  await caption(page, '✅ Normal: the shop shows its products', 'ok');
  await rec.snap(page, 1900);

  await app.chaos({ errorRate: 1, pathPrefix: '/api/products' });
  await caption(page, '💥 Chaos test: the product service is switched off on purpose…', 'warn');
  await rec.snap(page, 1900);
  await page.reload();
  await page.getByRole('alert').waitFor();
  await page.getByRole('alert').evaluate((el) => {
    el.style.outline = '4px solid #f5b301';
    el.style.outlineOffset = '4px';
  });
  await caption(page, '✔ Expected: a clear error message, not a blank or broken page', 'ok');
  await rec.snap(page, 2600);

  await app.chaos({});
  await caption(page, '🔧 The service is switched back on…', 'test');
  await rec.snap(page, 1400);
  await page.reload();
  await page.getByTestId('product-card').first().waitFor();
  await caption(page, '✔ The shop recovers by itself, no restart needed', 'ok');
  await rec.snap(page, 2800);

  rec.save();
  await browser.close();
  app.stop();
}
