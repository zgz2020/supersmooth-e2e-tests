import type { Page } from '@playwright/test';
import { ConnectWallet } from './connectWallet.js';

export class Modals {
  readonly page: Page;
  readonly connectWallet: ConnectWallet;

  constructor(page: Page) {
    this.page = page;
    this.connectWallet = new ConnectWallet(page);
  }
}

export * from './connectWallet.js';
