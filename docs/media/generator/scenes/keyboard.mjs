// Accessibility: buying with the keyboard only, showing the focus ring move.
import { chromium } from '@playwright/test';
import { startApp, caption, GifRecorder, alice, VIEW } from '../lib.mjs';

export default async function keyboard() {
  const app = await startApp(3903);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEW, bypassCSP: true });
  const rec = new GifRecorder('keyboard-test');
  const isFocused = (locator) => locator.evaluate((el) => el === document.activeElement);

  /** Presses Tab until `locator` has focus, recording every `every`-th step. */
  async function tabTo(locator, text, every = 1, ms = 420) {
    for (let i = 0; i < 25 && !(await isFocused(locator)); i += 1) {
      await page.keyboard.press('Tab');
      if (i % every === 0) {
        await caption(page, text, 'test');
        await rec.snap(page, ms);
      }
    }
  }

  await page.goto(`${app.base}/login`);
  await caption(page, '♿ Accessibility test: buying with the keyboard only, no mouse', 'test');
  await rec.snap(page, 1800);
  await page.keyboard.press('Tab');
  await caption(page, '⌨️ Tab → the first stop is “Skip to main content”', 'test');
  await rec.snap(page, 1500);
  await tabTo(page.getByLabel('Email'), '⌨️ Tab, Tab… the blue focus ring always shows where you are');
  await page.keyboard.type(alice.email);
  await caption(page, '⌨️ Type the email', 'test');
  await rec.snap(page, 800);
  await page.keyboard.press('Tab');
  await page.keyboard.type(alice.password);
  await caption(page, '⌨️ Tab → type the password → Enter', 'test');
  await rec.snap(page, 900);
  await page.keyboard.press('Enter');
  await page.getByTestId('product-card').first().waitFor();

  await tabTo(page.getByRole('link', { name: 'Bug Hunter Mug' }), '⌨️ Tab through the page to a product', 2, 380);
  await caption(page, '⌨️ Enter opens the product', 'test');
  await rec.snap(page, 1000);
  await page.keyboard.press('Enter');
  await page.getByTestId('product-detail').waitFor();
  await tabTo(page.getByRole('button', { name: 'Add to cart' }), '⌨️ Tab to “Add to cart”', 3, 380);
  await caption(page, '⌨️ Tab to “Add to cart” → Enter', 'test');
  await rec.snap(page, 1000);
  await page.keyboard.press('Enter');
  await page.getByRole('alert').waitFor();
  await caption(page, '✔ Added to cart. Every step worked without a mouse', 'ok');
  await rec.snap(page, 2800);

  rec.save();
  await browser.close();
  app.stop();
}
