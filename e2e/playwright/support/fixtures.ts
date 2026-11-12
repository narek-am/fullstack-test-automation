import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { CartPage } from '../pages/CartPage';
import { LoginPage } from '../pages/LoginPage';
import { OrdersPage } from '../pages/OrdersPage';
import { ProductListPage } from '../pages/ProductListPage';
import { ProductPage } from '../pages/ProductPage';
import type { TestUser } from './users';

type Pages = {
  productList: ProductListPage;
  productPage: ProductPage;
  loginPage: LoginPage;
  cartPage: CartPage;
  ordersPage: OrdersPage;
};

type Helpers = {
  /** Logs in through the API and puts the session in localStorage: much faster than the UI. */
  signIn: (user: TestUser) => Promise<string>;
  /** Removes everything from the user's cart via the API so a test starts from a known state. */
  resetCart: (user: TestUser) => Promise<void>;
};

async function apiLogin(request: APIRequestContext, user: TestUser) {
  const res = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } });
  expect(res, `login as ${user.email}`).toBeOK();
  return (await res.json()) as { token: string; user: unknown };
}

async function storeSession(page: Page, token: string, user: unknown) {
  await page.addInitScript(
    ([t, u]) => {
      window.localStorage.setItem('shoplite.token', t as string);
      window.localStorage.setItem('shoplite.user', JSON.stringify(u));
    },
    [token, user],
  );
}

export const test = base.extend<Pages & Helpers>({
  productList: async ({ page }, use) => use(new ProductListPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),

  signIn: async ({ page, request }, use) => {
    await use(async (user) => {
      const { token, user: profile } = await apiLogin(request, user);
      await storeSession(page, token, profile);
      return token;
    });
  },

  resetCart: async ({ request }, use) => {
    await use(async (user) => {
      const { token } = await apiLogin(request, user);
      const headers = { Authorization: `Bearer ${token}` };
      const cart = await (await request.get('/api/cart', { headers })).json();
      for (const item of cart.items as { productId: number }[]) {
        await request.delete(`/api/cart/items/${item.productId}`, { headers });
      }
    });
  },
});

export { expect };
