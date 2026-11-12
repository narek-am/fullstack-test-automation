import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductListPage extends BasePage {
  readonly searchInput: Locator;
  readonly categorySelect: Locator;
  readonly sortSelect: Locator;
  readonly applyButton: Locator;
  readonly resultCount: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByLabel('Search');
    this.categorySelect = page.getByLabel('Category');
    this.sortSelect = page.getByLabel('Sort by');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.resultCount = page.getByTestId('result-count');
    this.cards = page.getByTestId('product-card');
  }

  async goto(query = '') {
    await this.page.goto(`/${query}`);
    await this.resultCount.filter({ hasText: /found/ }).waitFor();
  }

  async filter({ search, category, sort }: { search?: string; category?: string; sort?: string }) {
    if (search !== undefined) await this.searchInput.fill(search);
    if (category !== undefined) await this.categorySelect.selectOption(category);
    if (sort !== undefined) await this.sortSelect.selectOption(sort);
    const response = this.page.waitForResponse((r) => r.url().includes('/api/products?'));
    await this.applyButton.click();
    await response;
  }

  card(name: string): Locator {
    return this.cards.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  async productNames(): Promise<string[]> {
    return this.cards.getByTestId('product-link').allTextContents();
  }

  async prices(): Promise<number[]> {
    const texts = await this.cards.getByTestId('product-price').allTextContents();
    return texts.map((t) => Number(t.replace(/[^0-9.]/g, '')));
  }

  async openProduct(name: string) {
    await this.page.getByRole('link', { name, exact: true }).click();
  }
}
