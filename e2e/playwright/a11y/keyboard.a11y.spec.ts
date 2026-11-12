import { type Locator, type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { users } from '../support/users';

// What automated scanners can't check: can the shop be used with a keyboard alone, is focus
// always visible, are changes announced, does the layout survive 400% zoom (320 CSS px).

/** Presses Tab until `target` has focus; fails if it can't be reached in `maxTabs` presses. */
async function tabTo(page: Page, target: Locator, maxTabs = 25) {
  for (let i = 0; i < maxTabs; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target, `reachable with Tab within ${maxTabs} presses`).toBeFocused();
}

test('a shopper can log in, buy a product and see the order with the keyboard only', async ({ page, resetCart }) => {
  await resetCart(users.alice);
  await page.goto('/login');

  await tabTo(page, page.getByLabel('Email'));
  await page.keyboard.type(users.alice.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.keyboard.type(users.alice.password);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('nav-greeting')).toHaveText('Hi, Alice');

  await tabTo(page, page.getByRole('link', { name: 'Bug Hunter Mug' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Bug Hunter Mug' })).toBeVisible();

  await tabTo(page, page.getByLabel('Quantity'));
  await page.keyboard.press('ArrowUp'); // 1 -> 2
  await tabTo(page, page.getByRole('button', { name: 'Add to cart' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Added to cart.');

  await tabTo(page, page.getByRole('link', { name: /^Cart/ }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Place order' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/orders\?placed=\d+/);
  await expect(page.getByTestId('orders-table')).toContainText('Bug Hunter Mug');
});

test('the skip link is the first stop and moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport(); // visible when focused, not left off-screen
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('every control on the product list shows a visible focus indicator', async ({ page, productList }) => {
  await productList.goto();
  const seen: string[] = [];
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        name: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.id).trim().slice(0, 30)}"`,
        outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        focusVisible: el.matches(':focus-visible'),
      };
    });
    if (!focused) break; // wrapped past the last control
    expect(focused, `focus indicator on ${focused.name}`).toMatchObject({ outline: true, focusVisible: true });
    seen.push(focused.name);
  }
  // Header links, filters and every product link must have been reached.
  expect(seen.length).toBeGreaterThan(10);
});

test('errors and confirmations are announced to screen readers', async ({ loginPage, page }) => {
  await loginPage.goto();
  await loginPage.login(users.alice.email, 'wrong-password');
  // role="alert" is a live region: screen readers read it out as soon as the text appears.
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
});

test('every page has a unique, descriptive title and exactly one h1', async ({ page, signIn }) => {
  await signIn(users.bob);
  const titles = new Map<string, string>();
  for (const path of ['/', '/product?id=1', '/product?id=3', '/login', '/cart', '/orders', '/missing-page']) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).not.toBeEmpty();
    const title = await page.title();
    expect(title, `title of ${path}`).toMatch(/^.+ \| ShopLite$/);
    expect(titles.get(title), `"${title}" is also the title of ${titles.get(title)}`).toBeUndefined();
    titles.set(title, path);
  }
});

test.describe('Reflow at 320 CSS pixels (400% zoom, WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ['/', '/product?id=1', '/login', '/cart', '/missing-page']) {
    test(`${path} needs no horizontal scrolling`, async ({ page, signIn, request }) => {
      const token = await signIn(users.bob);
      await request.post('/api/cart/items', { headers: { Authorization: `Bearer ${token}` }, data: { productId: 2, quantity: 1 } });
      await page.goto(path);
      await expect(page.locator('h1')).not.toBeEmpty();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'page is wider than the window').toBeLessThanOrEqual(0);
    });
  }
});
