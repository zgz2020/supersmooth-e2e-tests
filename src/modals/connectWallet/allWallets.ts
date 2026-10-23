import type { Page } from '@playwright/test';
import { expect, step } from '../../fixtures';
import type { Wallets } from '../../../utils/types/e2e/common';

export class AllWallets {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('All Wallets')).toBeVisible();
  }

  @step
  async search(text: string) {
    await this.page.getByTestId('wui-input-text').fill(text);
  }

  @step
  async shouldListWallets(wallets: Wallets[]) {
    for (const wallet of wallets) {
      await expect(this.page.getByRole('button', { name: wallet })).toBeVisible();
    }
  }

  @step
  async shouldNotListWallets(wallets: Wallets[]) {
    for (const wallet of wallets) {
      await expect(this.page.getByRole('button', { name: wallet })).not.toBeVisible();
    }
  }
}
