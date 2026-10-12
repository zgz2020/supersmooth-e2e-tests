import { Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import { expect } from '../../fixtures/base';
import type { Token } from '../../../utils/types/e2e/common.js';

export class ConfigurePosition {
  readonly page: Page;
  readonly panelLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.locator('[data-open-position-sidebar]');
  }

  @step
  async waitToBeStable({ token }: { token: Token }) {
    await expect(
      this.page.locator('button').filter({ has: this.page.getByText(token, { exact: true }) }),
    ).toBeVisible();
  }

  @step
  async setDeposit(amount: string) {
    await this.page.getByLabel(/Deposit/).fill(amount);
  }

  @step
  async setBorrow(amount: string) {
    await this.page.getByLabel('Borrow').fill(amount);
  }

  @step
  async openPosition() {
    await this.panelLocator.getByRole('button', { name: 'Open Position' }).click();
  }
}
