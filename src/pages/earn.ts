import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures/index.ts';

export class Earn {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async open() {
    await this.page.goto('/products/earn');
  }

  @step
  async shouldBeOpened() {
    await expect(
      this.page.getByText('Deposit a single asset into curated lending markets and vaults', {
        exact: false,
      }),
    ).toBeVisible();
  }
}
