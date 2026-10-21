import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures';

export class GetHelp {
  readonly page: Page;

  readonly modalLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modalLocator = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Get Help' }) });
  }

  @step
  async shouldBeVisible() {
    await expect(this.modalLocator).toBeVisible();
  }
}
