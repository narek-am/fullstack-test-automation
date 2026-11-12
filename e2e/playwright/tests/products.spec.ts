import { test, expect } from '../support/fixtures';

test.describe('Product catalogue', () => {
  test.beforeEach(async ({ productList }) => {
    await productList.goto();
  });

  test('shows all products sorted by name', async ({ productList }) => {
    await expect(productList.cards).toHaveCount(6);
    await expect(productList.resultCount).toHaveText('6 products found');
    const names = await productList.productNames();
    expect(names).toEqual([...names].sort());
  });

  test('marks sold-out products', async ({ productList }) => {
    const headphones = productList.card('Noise-Cancelling Headphones');
    await expect(headphones.getByTestId('product-stock')).toHaveText('Out of stock');
    await expect(headphones.getByTestId('product-stock')).toHaveClass(/stock-out/);
  });

  test('searches by keyword', async ({ productList }) => {
    await productList.filter({ search: 'mug' });
    await expect(productList.cards).toHaveCount(1);
    await expect(productList.card('Bug Hunter Mug')).toBeVisible();
    await expect(productList.resultCount).toHaveText('1 product found');
  });

  test('shows a friendly result for a search with no matches', async ({ productList }) => {
    await productList.filter({ search: 'does-not-exist' });
    await expect(productList.cards).toHaveCount(0);
    await expect(productList.resultCount).toHaveText('0 products found');
  });

  test('filters by category and sorts by price', async ({ productList }) => {
    await productList.filter({ category: 'hardware', sort: 'price_desc' });
    await expect(productList.cards).toHaveCount(2);
    const prices = await productList.prices();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test('keeps filters in the URL so results can be shared', async ({ page, productList }) => {
    await productList.filter({ search: 'book', sort: 'price_asc' });
    await expect(page).toHaveURL(/search=book/);
    await page.reload();
    await expect(productList.searchInput).toHaveValue('book');
    await expect(productList.sortSelect).toHaveValue('price_asc');
  });

  test('renders HTML in search input as plain text (no XSS)', async ({ page, productList }) => {
    let dialogOpened = false;
    page.on('dialog', async (dialog) => {
      dialogOpened = true;
      await dialog.dismiss();
    });
    await productList.filter({ search: '<img src=x onerror=alert(1)>' });
    await expect(productList.resultCount).toHaveText('0 products found');
    expect(dialogOpened).toBe(false);
  });

  test('opens product details', async ({ page, productList, productPage }) => {
    await productList.openProduct('Mechanical Keyboard');
    await expect(page).toHaveTitle('Mechanical Keyboard | ShopLite');
    await expect(productPage.name).toHaveText('Mechanical Keyboard');
    await expect(productPage.price).toHaveText('$89.99');
  });
});

test.describe('Product page edge cases', () => {
  test('shows "not found" for an unknown product', async ({ productPage }) => {
    await productPage.goto(9999);
    await expect(productPage.message).toHaveText('Product not found.');
  });

  test('disables "Add to cart" for sold-out products', async ({ productPage }) => {
    await productPage.goto(6);
    await expect(productPage.addToCartButton).toBeDisabled();
  });

  test('asks anonymous users to log in before adding to cart', async ({ page, productPage }) => {
    await productPage.goto(1);
    await productPage.addToCart();
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('shows the HTML 404 page for unknown URLs', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
