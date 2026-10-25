import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import { ProductsTopNavigation } from './productsTopNavigation';

export class Borrow {
  readonly page: Page;
  readonly productsTopNavigation: ProductsTopNavigation;

  constructor(page: Page) {
    this.page = page;
    this.productsTopNavigation = new ProductsTopNavigation(page);
  }

  @step
  async open() {
    await this.page.goto('/products/borrow');
  }

  @step
  async shouldBeOpened() {
    await expect(
      this.page.getByText('Borrow against your crypto collateral at competitive variable rates', {
        exact: false,
      }),
    ).toBeVisible();
  }
}
