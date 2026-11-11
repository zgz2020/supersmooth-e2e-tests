import type { Page } from '@playwright/test';
import { expect, step } from '../../fixtures';
import { ChooseNetwork } from './chooseNetwork';
import type { Network } from '../../../utils/types/api/common';

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
  async shouldHaveNetworkSelected(network: Network) {
    await expect(this.page.getByTestId('w3m-account-select-network')).toHaveAttribute(
      'active-network',
      new RegExp(`${network}`, 'i'),
    );
  }

  @step
  async openNetworkSelector() {
    await this.page.getByTestId('w3m-account-select-network').locator('button').click();
  }

  @step
  async closeModal() {
    // Both AppKit views share the same header close button
    await this.chooseNetwork.closeModal();
  }
}
