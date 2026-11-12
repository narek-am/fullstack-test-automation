import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class OrdersPage extends BasePage {
  readonly rows: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.rows = page.getByTestId('order-row');
    this.emptyMessage = page.getByTestId('orders-empty');
  }

  async goto() {
    await this.page.goto('/orders');
  }
}
