import { type Locator, type Page } from '@playwright/test';

/** Elements shared by every page (header navigation and the message banner). */
export abstract class BasePage {
  readonly cartCount: Locator;
  readonly loginLink: Locator;
  readonly logoutButton: Locator;
  readonly ordersLink: Locator;
  readonly greeting: Locator;
  readonly message: Locator;

  constructor(readonly page: Page) {
    this.cartCount = page.getByTestId('cart-count');
    this.loginLink = page.getByTestId('nav-login');
    this.logoutButton = page.getByTestId('nav-logout');
    this.ordersLink = page.getByTestId('nav-orders');
    this.greeting = page.getByTestId('nav-greeting');
    this.message = page.getByTestId('message');
  }

  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('/');
  }
}
