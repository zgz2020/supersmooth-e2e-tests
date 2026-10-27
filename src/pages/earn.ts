import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import { ProductsTopNavigation } from './productsTopNavigation';
import { TopCards } from './topCards';

export class Earn {
  readonly page: Page;
  readonly productsTopNavigation: ProductsTopNavigation;
  readonly topCards: TopCards;

  constructor(page: Page) {
    this.page = page;
    this.productsTopNavigation = new ProductsTopNavigation(page);
    this.topCards = new TopCards(page);
  }

  @step
  async open() {
    await this.page.goto('/products/earn');
  }

  @step
  async shouldBeOpened() {
    await expect(
      this.page.getByText(/Correlated Efficiency \(E-Mode\)|Stablecoin Strategies/).first(),
    ).toBeVisible();
  }
}
