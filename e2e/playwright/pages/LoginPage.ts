import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { TestUser } from '../support/users';

export class LoginPage extends BasePage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(page: Page) {
    super(page);
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Log in' });
  }

  async goto(next?: string) {
    await this.page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async loginAs(user: TestUser) {
    await this.login(user.email, user.password);
  }
}
