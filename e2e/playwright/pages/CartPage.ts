import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly items: Locator;
  readonly emptyMessage: Locator;
  readonly subtotal: Locator;
  readonly shipping: Locator;
  readonly total: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.items = page.getByTestId('cart-item');
    this.emptyMessage = page.getByTestId('cart-empty');
    this.subtotal = page.getByTestId('cart-subtotal');
    this.shipping = page.getByTestId('cart-shipping');
    this.total = page.getByTestId('cart-total');
    this.checkoutButton = page.getByRole('button', { name: 'Place order' });
  }

  async goto() {
    const cartLoaded = this.page.waitForResponse((r) => r.url().endsWith('/api/cart'));
    await this.page.goto('/cart');
    await cartLoaded;
  }

  item(productName: string): Locator {
    return this.items.filter({ hasText: productName });
  }

  async setQuantity(productName: string, quantity: number) {
    const updated = this.page.waitForResponse((r) => r.request().method() === 'PUT');
    await this.page.getByLabel(`Quantity of ${productName}`).fill(String(quantity));
    await this.page.getByLabel(`Quantity of ${productName}`).press('Tab');
    await updated;
  }

  async remove(productName: string) {
    await this.page.getByRole('button', { name: `Remove ${productName}` }).click();
  }

  async placeOrder() {
    await this.checkoutButton.click();
    await this.page.waitForURL(/\/orders\?placed=\d+/);
  }
}
