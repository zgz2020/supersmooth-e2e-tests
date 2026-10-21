import { expect, type Page } from '@playwright/test';
import { step } from '../../fixtures';

export class Settings {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async shouldBeVisible() {
    await expect(
      this.page
        .getByRole('dialog')
        .filter({ has: this.page.getByRole('heading', { name: 'Settings' }) }),
    ).toBeVisible();
  }
}
