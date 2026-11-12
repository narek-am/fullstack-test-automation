import { test, expect } from '@playwright/test';
import { ShopLiteServer } from '../support/shoplite';

// Experiment: the server process restarts (a deploy, a crash, the platform moving it).
// Sessions live in memory and are lost; carts and orders live in SQLite and must survive.

const server = new ShopLiteServer(3602);
const bob = { email: 'bob@shoplite.test', password: 'Passw0rd!' };

test.beforeAll(async () => server.start());
test.afterAll(async () => server.stop());

test('after a restart the shopper is asked to log in again, and the cart is still there', async ({ page }) => {
  // Steady state: Bob is logged in with an item in his cart.
  await page.goto(`${server.baseURL}/login`);
  await page.getByLabel('Email').fill(bob.email);
  await page.getByLabel('Password').fill(bob.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByTestId('nav-greeting')).toHaveText('Hi, Bob');
  await page.goto(`${server.baseURL}/product?id=2`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('alert')).toHaveText('Added to cart.');

  // Fault: the server restarts while Bob's tab stays open.
  await server.restart();

  // Hypothesis: the next page tells Bob his session expired and takes him to the login form,
  // instead of a raw "Invalid or expired token" error under a header that still says "Hi, Bob".
  await page.goto(`${server.baseURL}/cart`);
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole('alert')).toHaveText('Your session has expired. Please log in again.');
  await expect(page.getByTestId('nav-greeting')).toBeHidden();

  // After logging in again he lands back on the cart, with the item he added before the restart.
  await page.getByLabel('Email').fill(bob.email);
  await page.getByLabel('Password').fill(bob.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-items')).toContainText('Clean Pipelines');
});
