import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures';

export class Migrate {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async open() {
    await this.page.goto('/migrate');
  }

  @step
  async shouldBeOpened() {
    await expect(
      this.page.getByRole('heading', { name: 'Migrate Position', exact: false }),
    ).toBeVisible();
  }
}
