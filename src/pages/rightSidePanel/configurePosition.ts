import { expect, Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import type { WaitToBeStableProps } from '../../../utils/types/e2e/common';

export class ConfigurePosition {
  readonly page: Page;
  readonly panelLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.getByTestId('right-side-panel');
  }

  @step
  async waitToBeStable({ collateral, trade }: WaitToBeStableProps) {
    if (trade) {
      await expect(
        this.panelLocator.getByRole('button', { name: 'Deposit from Base' }),
      ).toBeVisible();
    } else {
      await expect(
        this.panelLocator.getByTestId(/^input-box-deposit.*token-selector$/),
      ).toContainText(collateral);
    }
  }

  @step
  async setDeposit(amount: string) {
    await this.panelLocator.locator('input').first().fill(amount);
  }

  @step
  async setBorrow(amount: string) {
    await this.panelLocator.getByLabel('Borrow').fill(amount);
  }

  @step
  async openPosition() {
    await this.panelLocator
      .getByRole('button', { name: /^(Open Position|Deposit|Deposit from Base)$/ })
      .click();
  }

  @step
  async connectWallet() {
    await this.panelLocator.getByRole('button', { name: 'Connect Wallet' }).click();
  }
}
