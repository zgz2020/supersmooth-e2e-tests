import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures/index.js';
import type { Address } from '../../utils/types/api/common.js';

export class Header {
  readonly page: Page;
  readonly header: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole('navigation').first();
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
  async shouldHaveShortAddress(shortAddress: Address) {
    await expect(this.header.getByRole('button', { name: shortAddress })).toBeVisible();
  }
}
