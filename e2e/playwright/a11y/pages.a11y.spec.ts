import { test, expect } from '../support/fixtures';
import { users } from '../support/users';
import { expectNoAxeViolations } from './axe';

// Automated WCAG 2.2 AA checks with axe-core on every page, in the states a user actually sees
// (loaded data, errors, logged in). Automated tools find roughly a third of accessibility
// problems; keyboard.a11y.spec.ts covers what they can't, such as focus order.

test.describe('Logged out', () => {
  test('product list', async ({ productList }) => {
    await productList.goto();
    await expectNoAxeViolations(productList.page);
  });

  test('product list with no search results', async ({ productList }) => {
    await productList.goto();
    await productList.filter({ search: 'no-such-product' });
    await expect(productList.page.getByTestId('result-count')).toHaveText('0 products found');
    await expectNoAxeViolations(productList.page);
  });

  test('product details', async ({ productPage }) => {
    await productPage.goto(1);
    await expectNoAxeViolations(productPage.page);
  });

  test('sold-out product', async ({ productPage }) => {
    await productPage.goto(6);
    await expect(productPage.addToCartButton).toBeDisabled();
    await expectNoAxeViolations(productPage.page);
  });

  test('login form, empty and with an error', async ({ loginPage }) => {
    await loginPage.goto();
    await expectNoAxeViolations(loginPage.page);
    await loginPage.login('alice@shoplite.test', 'wrong-password');
    await expect(loginPage.message).toBeVisible();
    await expectNoAxeViolations(loginPage.page);
  });

  test('page not found', async ({ page }) => {
    await page.goto('/missing-page');
    await expectNoAxeViolations(page);
  });

  test('product list on a phone', async ({ page, productList }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await productList.goto();
    await expectNoAxeViolations(page);
  });
});

test.describe('Logged in', () => {
  test('cart with items, then empty', async ({ cartPage, signIn, resetCart, request }) => {
    await resetCart(users.bob);
    const token = await signIn(users.bob);
    await request.post('/api/cart/items', { headers: { Authorization: `Bearer ${token}` }, data: { productId: 3, quantity: 2 } });
    await cartPage.goto();
    await expectNoAxeViolations(cartPage.page);

    await resetCart(users.bob);
    await cartPage.goto();
    await expectNoAxeViolations(cartPage.page);
  });

  test('order history', async ({ ordersPage, signIn, request }) => {
    const token = await signIn(users.alice);
    const headers = { Authorization: `Bearer ${token}` };
    await request.post('/api/cart/items', { headers, data: { productId: 1, quantity: 1 } });
    await request.post('/api/orders', { headers });
    await ordersPage.goto();
    await expectNoAxeViolations(ordersPage.page);
  });
});
