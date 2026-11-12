import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  readonly name: Locator;
  readonly price: Locator;
  readonly stock: Locator;
  readonly quantity: Locator;
  readonly addToCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.getByTestId('product-name');
    this.price = page.getByTestId('product-price');
    this.stock = page.getByTestId('product-stock');
    this.quantity = page.getByLabel('Quantity');
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
  }

  async goto(id: number) {
    await this.page.goto(`/product?id=${id}`);
  }

  async addToCart(quantity = 1) {
    await this.quantity.fill(String(quantity));
    await this.addToCartButton.click();
  }
}
