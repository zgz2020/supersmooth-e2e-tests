import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures/index.js';
import type { Address } from '../../utils/types/api/common.js';

export type ShortAddress = Address | RegExp;

export class Header {
  readonly page: Page;
  readonly header: Locator;
  readonly connectedWalletButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole('navigation').first();
    this.connectedWalletButton = this.header.getByRole('button', {
      name: /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/,
    });
  }

  @step
  async shouldBeVisible() {
    await expect(this.header).toBeVisible();
  }

  @step
  async connectWallet() {
    await this.header.getByRole('button', { name: 'Connect Wallet' }).click();
  }

  @step
  async shouldHaveShortAddress(
    shortAddress: ShortAddress = /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/,
  ) {
    await expect(this.connectedWalletButton).toHaveText(shortAddress);
  }

  @step
  async openWalletFeatures() {
    await this.connectedWalletButton.click();
  }
}
