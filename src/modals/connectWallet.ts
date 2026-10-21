import type { Page } from '@playwright/test';
import { expect, step } from '../fixtures/index.ts';

export class ConnectWallet {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Search Wallet')).toBeVisible();
  }

  @step
  async connectMetaMask() {
    await this.page.getByRole('button', { name: 'MetaMask' }).click();
  }
}
