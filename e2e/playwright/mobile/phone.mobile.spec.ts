import { type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { users } from '../support/users';

// ShopLite on phones, emulated by Playwright: real mobile viewports, device pixel ratio, touch
// events and mobile user agents (Pixel 7 in Chromium, iPhone 14 in WebKit). Real devices and the
// real mobile Chrome are covered by the Appium suite in mobile-tests/.

const PAGES = ['/', '/product?id=1', '/login', '/cart', '/orders', '/missing-page'];

/** Interactive elements smaller than `min` CSS pixels in either direction (inline text links excluded). */
async function smallTapTargets(page: Page, min: number) {
  return page.evaluate((min) => {
    const isInlineTextLink = (el: Element) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p');
    return [...document.querySelectorAll('a[href], button, input, select, textarea')]
      .filter((el) => (el as HTMLElement).offsetParent !== null && !isInlineTextLink(el))
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < min || box.height < min)
      .map(({ el, box }) => `${el.tagName.toLowerCase()} "${(el.textContent || (el as HTMLInputElement).name || '').trim()}" ${Math.round(box.width)}x${Math.round(box.height)}`);
  }, min);
}

test.describe('Layout on a phone', () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn(users.bob);
  });

  for (const path of PAGES) {
    test(`${path} fits the screen: no sideways scrolling`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).not.toBeEmpty();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test(`${path} has tap targets of at least 24x24 px (WCAG 2.5.8)`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).not.toBeEmpty();
      expect(await smallTapTargets(page, 24)).toEqual([]);
    });
  }

  test('products are shown in a single column', async ({ page, productList }) => {
    await productList.goto();
    const lefts = await page.getByTestId('product-card').evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
  });

  test('pinch zoom is not disabled', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
  });
});

test('a shopper can buy a product with taps only', async ({ page, resetCart }) => {
  await resetCart(users.alice);
  await page.goto('/login');
  await page.getByLabel('Email').tap();
  await page.keyboard.type(users.alice.email);
  await page.getByLabel('Password').tap();
  await page.keyboard.type(users.alice.password);
  await page.getByRole('button', { name: 'Log in' }).tap();
  await expect(page.getByTestId('nav-greeting')).toHaveText('Hi, Alice');

  await page.getByRole('link', { name: 'Bug Hunter Mug' }).tap();
  await page.getByRole('button', { name: 'Add to cart' }).tap();
  await expect(page.getByRole('alert')).toHaveText('Added to cart.');
  await expect(page.getByTestId('cart-count')).toHaveText('1');

  await page.getByRole('link', { name: /^Cart/ }).tap();
  await page.getByRole('button', { name: 'Place order' }).tap();
  await expect(page).toHaveURL(/\/orders\?placed=\d+/);
  await expect(page.getByTestId('orders-table')).toContainText('Bug Hunter Mug');
});

test('form fields bring up the right on-screen keyboard', async ({ page }) => {
  // The input type and attributes decide which keyboard a phone shows and what autofill offers.
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email');
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'current-password');

  await page.goto('/');
  await expect(page.getByLabel('Search')).toHaveAttribute('type', 'search');

  await page.goto('/product?id=1');
  await expect(page.getByLabel('Quantity')).toHaveAttribute('inputmode', 'numeric');
});

test.describe('Landscape', () => {
  test('the product page fits a phone held sideways and still works', async ({ page, productPage, signIn, resetCart }) => {
    await resetCart(users.bob);
    await signIn(users.bob);
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await productPage.goto(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // On a short landscape screen the button may be below the fold; tapping scrolls to it.
    await productPage.addToCartButton.tap();
    await expect(page.getByRole('alert')).toHaveText('Added to cart.');
    await resetCart(users.bob);
  });
});
