// A UI test buying a product, step by step.
import { chromium } from '@playwright/test';
import { startApp, caption, GifRecorder, point, typeInto, alice, VIEW } from '../lib.mjs';

export default async function ui() {
  const app = await startApp(3901);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEW, bypassCSP: true });
  const rec = new GifRecorder('ui-test');

  await page.goto(`${app.base}/login`);
  await caption(page, '🤖 An automated UI test opens the shop and logs in as a customer', 'test');
  await rec.snap(page, 1400);
  await typeInto(rec, page, page.getByLabel('Email'), alice.email);
  await typeInto(rec, page, page.getByLabel('Password'), alice.password, 3);
  await point(page.getByRole('button', { name: 'Log in' }));
  await rec.snap(page, 700);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByTestId('product-card').first().waitFor();

  await caption(page, '🛒 It picks a product…', 'test');
  await point(page.getByRole('link', { name: 'Bug Hunter Mug' }));
  await rec.snap(page, 1300);
  await page.getByRole('link', { name: 'Bug Hunter Mug' }).click();
  await page.getByTestId('product-detail').waitFor();
  await caption(page, '…and adds it to the cart', 'test');
  await point(page.getByRole('button', { name: 'Add to cart' }));
  await rec.snap(page, 1100);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('alert').waitFor();
  await caption(page, '✔ Checked: the cart badge now shows 1 item', 'ok');
  await point(page.getByTestId('cart-count'));
  await rec.snap(page, 1500);

  await page.getByRole('link', { name: /^Cart/ }).click();
  await page.getByTestId('cart-contents').waitFor();
  await caption(page, '💳 It places the order', 'test');
  await point(page.getByRole('button', { name: 'Place order' }));
  await rec.snap(page, 1300);
  await page.getByRole('button', { name: 'Place order' }).click();
  await page.getByTestId('orders-table').waitFor();
  await caption(page, '✔ Test passed: the order is in the order history', 'ok');
  await point(page.getByTestId('order-row').first());
  await rec.snap(page, 2600);

  rec.save();
  await browser.close();
  app.stop();
}
