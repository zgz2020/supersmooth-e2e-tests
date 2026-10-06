import { Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import { expect } from '../../fixtures/base';

export class ConfigurePosition {
  readonly page: Page;
  readonly panelLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.locator('[data-open-position-sidebar]');
  }

  @step
  async waitToBeStable({ token }: { token: 'ETH' | 'USDC' | 'USDT' | 'WBTC' }) {
    await expect(
      this.panelLocator
        .locator('button[aria-haspopup="listbox"]')
        .getByText(token, { exact: true })
        .first(),
    ).toBeVisible();
  }

  @step
  async setDeposit(amount: string) {
    await this.panelLocator.locator('input').first().fill(amount);
  }

  @step
  async openPosition() {
    await this.panelLocator.getByRole('button', { name: 'Open Position' }).click();
  }
}
