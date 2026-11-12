import { test, expect } from '../support/fixtures';
import { users } from '../support/users';

// Full user journey through the UI, using Alice's account.
test.describe.configure({ mode: 'serial' });

test('customer can find a product, buy it and see the order', async ({
  page, resetCart, loginPage, productList, productPage, cartPage, ordersPage,
}) => {
  await resetCart(users.alice);

  await test.step('log in', async () => {
    await loginPage.goto();
    await loginPage.loginAs(users.alice);
    await expect(loginPage.greeting).toHaveText('Hi, Alice');
  });

  await test.step('find the product', async () => {
    await productList.filter({ search: 'T-Shirt' });
    await productList.openProduct('Green Build T-Shirt');
    await expect(productPage.name).toHaveText('Green Build T-Shirt');
  });

  await test.step('add it to the cart', async () => {
    await productPage.addToCart(1);
    await expect(productPage.cartCount).toHaveText('1');
  });

  let orderNumber = '';
  await test.step('place the order', async () => {
    await cartPage.goto();
    await expect(cartPage.total).toHaveText('$24.98');
    await cartPage.placeOrder();
    orderNumber = new URL(page.url()).searchParams.get('placed') ?? '';
    await expect(ordersPage.message).toHaveText(`Thank you! Order #${orderNumber} has been placed.`);
  });

  await test.step('see it in order history', async () => {
    const row = ordersPage.rows.filter({ hasText: `#${orderNumber}` });
    await expect(row).toContainText('PLACED');
    await expect(row).toContainText('1 × Green Build T-Shirt');
    await expect(row).toContainText('$24.98');
    await expect(ordersPage.cartCount).toHaveText('0');
  });
});

test('shows the stock reduced after an order', async ({ request, resetCart, signIn, productPage, cartPage }) => {
  await resetCart(users.alice);
  const before = (await (await request.get('/api/products/3')).json()).stock as number;

  await signIn(users.alice);
  await productPage.goto(3);
  await productPage.addToCart(2);
  await cartPage.goto();
  await cartPage.placeOrder();

  await productPage.goto(3);
  await expect(productPage.stock).toHaveText(`${before - 2} in stock`);
});
