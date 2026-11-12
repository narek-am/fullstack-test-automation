import { test, expect } from '../support/fixtures';
import { users } from '../support/users';

// Full-page and component screenshots compared with approved baselines in __screenshots__/.
// BackstopJS (visual-tests/backstop) covers whole pages per viewport; these tests focus on
// what Playwright does well: element-level shots, masking dynamic data and UI states.

test.describe('Full pages', () => {
  test('product list, with stock counts masked', async ({ page, productList }) => {
    await productList.goto();
    // Stock changes whenever someone buys something; mask it so only layout and styling are compared.
    await expect(page).toHaveScreenshot('product-list.png', {
      fullPage: true,
      mask: [page.getByTestId('product-stock')],
    });
  });

  test('product list on a phone', async ({ page, productList }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await productList.goto();
    await expect(page).toHaveScreenshot('product-list-phone.png', {
      mask: [page.getByTestId('product-stock')],
    });
  });

  test('404 page', async ({ page }) => {
    await page.goto('/missing-page');
    await expect(page).toHaveScreenshot('not-found.png');
  });
});

test.describe('Components', () => {
  test('product card', async ({ productList }) => {
    await productList.goto();
    await expect(productList.card('Mechanical Keyboard')).toHaveScreenshot('product-card.png', {
      mask: [productList.card('Mechanical Keyboard').getByTestId('product-stock')],
    });
  });

  test('sold-out product card', async ({ productList }) => {
    await productList.goto();
    await expect(productList.card('Noise-Cancelling Headphones')).toHaveScreenshot('product-card-sold-out.png');
  });

  test('filter bar', async ({ productList }) => {
    await productList.goto();
    await expect(productList.page.getByTestId('filters')).toHaveScreenshot('filter-bar.png');
  });

  test('header, logged out and logged in', async ({ page, signIn }) => {
    await page.goto('/login');
    const header = page.locator('.site-header');
    await expect(header).toHaveScreenshot('header-logged-out.png');

    await signIn(users.alice);
    await page.goto('/login');
    await expect(page.getByTestId('nav-greeting')).toHaveText('Hi, Alice');
    await expect(header).toHaveScreenshot('header-logged-in.png');
  });

  test('error and success banners', async ({ loginPage, productPage, signIn, resetCart }) => {
    await loginPage.goto();
    await loginPage.submit.click();
    await expect(loginPage.message).toHaveScreenshot('banner-error.png');

    await resetCart(users.alice);
    await signIn(users.alice);
    await productPage.goto(1);
    await productPage.addToCart(1);
    await expect(productPage.message).toHaveText('Added to cart.');
    await expect(productPage.message).toHaveScreenshot('banner-success.png');
    await resetCart(users.alice);
  });

  test('cart totals', async ({ cartPage, signIn, resetCart, request }) => {
    await resetCart(users.bob);
    const token = await signIn(users.bob);
    const headers = { Authorization: `Bearer ${token}` };
    await request.post('/api/cart/items', { headers, data: { productId: 3, quantity: 2 } });
    await cartPage.goto();
    await expect(cartPage.page.locator('.totals')).toHaveScreenshot('cart-totals.png');
    await resetCart(users.bob);
  });
});

test.describe('Interaction states of the primary button', () => {
  // These images are tiny and mostly text, so font anti-aliasing differs by up to ~60 pixels
  // between macOS versions (measured on the CI runner: 57). Real regressions are far larger:
  // removing the focus ring changes 588 pixels, a hover colour change affects the whole button.
  const smallUi = { maxDiffPixels: 100 };

  test('default, hover, keyboard focus and disabled', async ({ page, productPage }) => {
    await productPage.goto(1);
    const button = productPage.addToCartButton;
    await expect(button).toHaveScreenshot('button-default.png', smallUi);

    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png', smallUi);

    await page.mouse.move(0, 0);
    await productPage.quantity.focus();
    await page.keyboard.press('Tab'); // keyboard focus shows the :focus-visible outline
    await expect(button).toBeFocused();
    // Functional check first: keyboard focus must produce the visible focus ring.
    const ring = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return { focusVisible: el.matches(':focus-visible'), outline: `${style.outlineStyle} ${style.outlineWidth}` };
    });
    expect(ring).toEqual({ focusVisible: true, outline: 'solid 3px' });
    // The outline is drawn outside the button (3px + 2px offset), so clip a box 6px larger than the
    // button. Clipping (instead of shooting the whole form) keeps the OS-drawn number input out.
    const box = await button.boundingBox();
    if (!box) throw new Error('button is not visible');
    // Anti-aliasing of the text and the ring's rounded corners differs by ~135 pixels on the CI
    // runner. The ring itself is ~1000 pixels, so a colour or thickness change still fails.
    await expect(page).toHaveScreenshot('button-focus-visible.png', {
      maxDiffPixels: 300,
      clip: { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 },
    });

    await productPage.goto(6); // sold out
    await expect(productPage.addToCartButton).toBeDisabled();
    await expect(productPage.addToCartButton).toHaveScreenshot('button-disabled.png', smallUi);
  });
});
