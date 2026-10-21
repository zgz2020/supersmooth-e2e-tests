import type { Page } from '@playwright/test';
import { ConnectWallet } from './connectWallet.ts';
import { WalletFeatures } from './walletFeatures/index.ts';

export class Modals {
  readonly page: Page;
  readonly connectWallet: ConnectWallet;
  readonly walletFeatures: WalletFeatures;

  constructor(page: Page) {
    this.page = page;
    this.connectWallet = new ConnectWallet(page);
    this.walletFeatures = new WalletFeatures(page);
  }
}
