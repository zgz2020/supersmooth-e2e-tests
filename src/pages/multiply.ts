import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import { ProductsTopNavigation } from './productsTopNavigation';

export class Multiply {
  readonly page: Page;
  readonly productsTopNavigation: ProductsTopNavigation;

  constructor(page: Page) {
    this.page = page;
    this.productsTopNavigation = new ProductsTopNavigation(page);
  }

  @step
  async open() {
    await this.page.goto('/products/multiply');
  }

  @step
  async shouldBeOpened() {
    await expect(
      this.page.getByText('Amplify long or short exposure to an asset in a single position', {
        exact: false,
      }),
    ).toBeVisible();
  }
}
