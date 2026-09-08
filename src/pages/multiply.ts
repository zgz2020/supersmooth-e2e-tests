import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures/index.js';

export class Multiply {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async open() {
    await this.page.goto('/products/multiply');
  }

  @step
  async shouldBeOpened() {
    await expect(this.page.getByText('Amplify long or short exposure to an asset in a single position', { exact: false })).toBeVisible();
  }
}



