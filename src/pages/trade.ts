import { type Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import { ProductsTopNavigation } from './productsTopNavigation';

export class Trade {
  readonly page: Page;
  readonly productsTopNavigation: ProductsTopNavigation;

  constructor(page: Page) {
    this.page = page;
    this.productsTopNavigation = new ProductsTopNavigation(page);
  }

  @step
  async open() {
    await this.page.goto('/products/trade');
  }

  @step
  async shouldBeOpened() {
    await expect(this.page.getByRole('tab', { name: 'Perpetual Contracts' })).toBeVisible();
  }
}
