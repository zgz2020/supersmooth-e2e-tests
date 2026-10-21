import type { Page } from '@playwright/test';
import { ConnectWallet } from './connectWallet';
import { GetHelp } from './getHelp';
import { Settings } from './settings';
import { WalletFeatures } from './walletFeatures';

export class Modals {
  readonly page: Page;
  readonly connectWallet: ConnectWallet;
  readonly getHelp: GetHelp;
  readonly settings: Settings;
  readonly walletFeatures: WalletFeatures;

  constructor(page: Page) {
    this.page = page;
    this.connectWallet = new ConnectWallet(page);
    this.getHelp = new GetHelp(page);
    this.settings = new Settings(page);
    this.walletFeatures = new WalletFeatures(page);
  }
}
