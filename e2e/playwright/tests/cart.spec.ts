import { test, expect } from '../support/fixtures';
import { users } from '../support/users';

// Uses Bob's cart only, and runs in order, so it never races with other specs.
test.describe.configure({ mode: 'serial' });

test.describe('Shopping cart', () => {
  test.beforeEach(async ({ resetCart, signIn }) => {
    await resetCart(users.bob);
    await signIn(users.bob);
  });

  test('adds a product and updates the header badge', async ({ productPage }) => {
    await productPage.goto(3);
    await productPage.addToCart(2);
    await expect(productPage.message).toHaveText('Added to cart.');
    await expect(productPage.cartCount).toHaveText('2');
  });

  test('shows line totals, shipping and grand total', async ({ productPage, cartPage }) => {
    await productPage.goto(3); // Bug Hunter Mug, $12.99
    await productPage.addToCart(2);
    await cartPage.goto();

    await expect(cartPage.item('Bug Hunter Mug').getByTestId('cart-item-total')).toHaveText('$25.98');
    await expect(cartPage.subtotal).toHaveText('$25.98');
    await expect(cartPage.shipping).toHaveText('$4.99');
    await expect(cartPage.total).toHaveText('$30.97');
  });

  test('gives free shipping from $50', async ({ productPage, cartPage }) => {
    await productPage.goto(1); // Testing Handbook, $29.99
    await productPage.addToCart(2);
    await cartPage.goto();
    await expect(cartPage.shipping).toHaveText('Free');
    await expect(cartPage.total).toHaveText('$59.98');
  });

  test('changes quantity and recalculates', async ({ productPage, cartPage }) => {
    await productPage.goto(3);
    await productPage.addToCart(1);
    await cartPage.goto();
    await cartPage.setQuantity('Bug Hunter Mug', 4);
    await expect(cartPage.subtotal).toHaveText('$51.96');
    await expect(cartPage.shipping).toHaveText('Free');
    await expect(cartPage.cartCount).toHaveText('4');
  });

  test('blocks a quantity above the available stock before calling the API', async ({ page, productPage }) => {
    // The quantity field has max=<stock>, so native form validation stops the submit.
    // The server-side 409 for this case is covered by the API test suites.
    const cartRequests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/cart/items')) cartRequests.push(r.method()); });

    await productPage.goto(5); // Mechanical Keyboard, 3 in stock
    await expect(productPage.quantity).toHaveAttribute('max', '3');
    await productPage.addToCart(4);

    const validity = await productPage.quantity.evaluate((el: HTMLInputElement) => ({
      rangeOverflow: el.validity.rangeOverflow,
      message: el.validationMessage,
    }));
    expect(validity.rangeOverflow).toBe(true);
    expect(validity.message).not.toBe('');
    expect(cartRequests).toEqual([]);
    await expect(productPage.cartCount).toHaveText('0');
  });

  test('removes a product and shows the empty state', async ({ productPage, cartPage }) => {
    await productPage.goto(3);
    await productPage.addToCart(1);
    await cartPage.goto();
    await cartPage.remove('Bug Hunter Mug');
    await expect(cartPage.emptyMessage).toBeVisible();
    await expect(cartPage.cartCount).toHaveText('0');
  });
});
