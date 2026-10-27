import { expect, Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import type { WaitToBeStableProps } from '../../../utils/types/e2e/common';
import { defaultExpectTimeout } from '../../../utils/constants/timeouts';

export class ConfigurePosition {
  readonly page: Page;
  readonly panelLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.locator('[data-open-position-sidebar]');
    // TODO: Add testid for all position types to create a proper 'panelLocator'
  }

  @step
  async waitToBeStable({ collateral, trade }: WaitToBeStableProps) {
    if (trade) {
      await expect(this.page.getByRole('button', { name: 'Deposit from Base' })).toBeVisible({
        timeout: defaultExpectTimeout * 2,
      });
    } else {
      await expect(
        this.page
          .locator('button')
          .filter({ has: this.page.getByText(collateral!, { exact: true }) }),
      ).toBeVisible();
    }
  }

  @step
  async setDeposit(amount: string) {
    await this.page.locator('input').first().fill(amount);
  }

  @step
  async setBorrow(amount: string) {
    await this.page.getByLabel('Borrow').fill(amount);
  }

  @step
  async openPosition() {
    await this.page
      .getByRole('button', { name: /^(Open Position|Deposit|Deposit from Base)$/ })
      .click();
  }

  @step
  async connectWallet() {
    await this.page.getByRole('button', { name: 'Connect Wallet' }).last().click();
  }
}
