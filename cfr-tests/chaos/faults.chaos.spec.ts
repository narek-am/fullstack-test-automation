import { test, expect, type Page } from '@playwright/test';
import { ShopLiteServer } from '../support/shoplite';

// Chaos experiments: break one dependency of the shopper's journey on purpose and check that the
// shop degrades the way we expect. Each experiment has
//   - a steady state (what "working" means, checked before the fault),
//   - a hypothesis (what users should see while the fault is active),
//   - a rollback (the fault is removed after every experiment, and the shop must recover).

const server = new ShopLiteServer(3601);
const bob = { email: 'bob@shoplite.test', password: 'Passw0rd!' };

async function logIn(page: Page, user = bob) {
  const { token, user: profile } = await server.api('/auth/login', { method: 'POST', body: user });
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('shoplite.token', t as string);
      localStorage.setItem('shoplite.user', JSON.stringify(u));
    },
    [token, profile],
  );
  return token as string;
}

async function emptyCart(token: string) {
  const cart = await server.api('/cart', { token });
  for (const item of cart.items) await server.api(`/cart/items/${item.productId}`, { method: 'DELETE', token });
}

test.beforeAll(async () => server.start());
test.afterEach(async () => server.heal()); // rollback, even when the experiment fails
test.afterAll(async () => server.stop());

test('product API down: the list page shows an error instead of a blank page, and recovers', async ({ page }) => {
  // Steady state
  await page.goto(`${server.baseURL}/`);
  await expect(page.getByTestId('product-card')).toHaveCount(6);

  // Fault: every product request fails with 503
  await server.inject({ errorRate: 1, pathPrefix: '/api/products' });
  await page.reload();

  // Hypothesis: the user is told what happened, and the rest of the page still works
  await expect(page.getByRole('alert')).toContainText('Could not load products');
  await expect(page.getByTestId('product-card')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

  // Rollback and recovery: no restart or cache clearing needed
  await server.heal();
  await page.reload();
  await expect(page.getByTestId('product-card')).toHaveCount(6);
  await expect(page.getByRole('alert')).toBeHidden();
});

test('checkout fails: the cart is kept, no order is created and stock is unchanged', async ({ page }) => {
  const token = await logIn(page);
  await emptyCart(token);
  await server.api('/cart/items', { method: 'POST', token, body: { productId: 1, quantity: 2 } });
  const stockBefore = (await server.api('/products/1')).stock;
  const ordersBefore = (await server.api('/orders', { token })).length;

  await page.goto(`${server.baseURL}/cart`);
  await expect(page.getByTestId('cart-contents')).toBeVisible();

  await server.inject({ errorRate: 1, pathPrefix: '/api/orders' });
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-items')).toContainText('Testing Handbook');

  // Rollback, then check the data (these checks would also hit the fault while it is active).
  await server.heal();
  expect((await server.api('/cart', { token })).items).toEqual([expect.objectContaining({ productId: 1, quantity: 2 })]);
  expect((await server.api('/products/1')).stock).toBe(stockBefore);
  expect(await server.api('/orders', { token })).toHaveLength(ordersBefore);

  // After recovery the same click works, and only one order is created.
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\?placed=\d+/);
  expect(await server.api('/orders', { token })).toHaveLength(ordersBefore + 1);
});

test('slow API: a double click on "Add to cart" adds the item once', async ({ page }) => {
  const token = await logIn(page);
  await emptyCart(token);
  await page.goto(`${server.baseURL}/product?id=3`);
  await expect(page.getByTestId('product-detail')).toBeVisible();

  // 1.5 s per cart request: long enough that an impatient user clicks again.
  await server.inject({ latencyMs: 1500, pathPrefix: '/api/cart' });
  await page.getByRole('button', { name: 'Add to cart' }).dblclick();
  await expect(page.getByRole('alert')).toHaveText('Added to cart.', { timeout: 10_000 });
  await server.heal();

  const cart = await server.api('/cart', { token });
  expect(cart.items, 'one click = one item, even on a slow connection').toEqual([
    expect.objectContaining({ productId: 3, quantity: 1 }),
  ]);
});

test('slow API: pages still load, and finish within the latency plus a small margin', async ({ page }) => {
  await server.inject({ latencyMs: 2000 });
  const started = Date.now();
  await page.goto(`${server.baseURL}/product?id=1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Testing Handbook', { timeout: 10_000 });
  // The product page makes its API calls in parallel, so 2 s of latency should cost about 2 s, not 4.
  expect(Date.now() - started).toBeLessThan(3500);
});
