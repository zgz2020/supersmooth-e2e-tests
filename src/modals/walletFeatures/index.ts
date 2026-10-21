import type { Page } from '@playwright/test';
import { expect, step } from '../../fixtures/index.ts';
import { ChooseNetwork } from './chooseNetwork.ts';

export class WalletFeatures {
  readonly page: Page;
  readonly chooseNetwork: ChooseNetwork;

  constructor(page: Page) {
    this.page = page;
    this.chooseNetwork = new ChooseNetwork(page);
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Disconnect')).toBeVisible();
  }

  @step
  async openNetworkSelector() {
    await this.page.getByTestId('w3m-account-select-network').locator('button').click();
  }
}
