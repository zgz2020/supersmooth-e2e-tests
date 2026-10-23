import type { Page } from '@playwright/test';
import { expect, step } from '../../fixtures';
import { AllWallets } from './allWallets';
import type { Wallets } from '../../../utils/types/e2e/common';

export class ConnectWallet {
  readonly page: Page;

  readonly allWallets: AllWallets;

  constructor(page: Page) {
    this.page = page;
    this.allWallets = new AllWallets(page);
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Search Wallet')).toBeVisible();
  }

  @step
  async connectMetaMask() {
    await this.page.getByRole('button', { name: 'MetaMask' }).click();
  }

  @step
  async shouldListWallets(wallets: Wallets[]) {
    for (const wallet of wallets) {
      await expect(this.page.getByRole('button', { name: wallet })).toBeVisible();
    }
  }

  @step
  async openSearch() {
    await this.page.getByRole('button', { name: 'Search Wallet' }).click();
  }
}
