import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import type { Address } from '../../utils/types/api/common';

type ShortAddress = Address | RegExp;
type LandingPageMenuOptions = 'Earn' | 'Borrow' | 'Multiply';
type AppMenuOptions = 'Products' | 'Portfolio' | 'Migrate';

export class Header {
  readonly page: Page;
  readonly headerLocator: Locator;
  readonly connectWalletButton: Locator;
  readonly connectedWalletButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerLocator = page.getByRole('navigation').first();
    this.connectWalletButton = this.headerLocator.getByRole('button', { name: 'Connect Wallet' });
    this.connectedWalletButton = this.headerLocator.getByRole('button', {
      name: /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/,
    });
  }

  @step
  async shouldBeVisible() {
    await expect(this.headerLocator).toBeVisible();
  }

  @step
  async clickOnSupersmoothLogo() {
    await this.headerLocator.getByRole('link', { name: 'Supersmooth' }).click();
  }

  @step
  async goTo(menuOption: LandingPageMenuOptions | AppMenuOptions) {
    await this.headerLocator.getByRole('link', { name: menuOption, exact: true }).click();
  }

  @step
  async goToSecuritySection() {
    await this.headerLocator.getByRole('link', { name: 'Security', exact: true }).click();
  }

  @step
  async shouldOpenDocsInNewTab() {
    const docsLink = this.headerLocator.getByRole('link', { name: 'Docs', exact: true });

    await expect(docsLink).toHaveAttribute('target', '_blank');
    await expect(docsLink).toHaveAttribute(
      'href',
      'https://supersmooth.mintlify.site/introduction',
    );
  }

  @step
  async launchApp() {
    await this.headerLocator.getByRole('link', { name: 'Launch app', exact: true }).click();
  }

  @step
  async getHelp() {
    await this.headerLocator.getByRole('button', { name: 'Get Help', exact: true }).click();
  }

  @step
  async shouldShowConnectWallet() {
    await expect(this.connectWalletButton).toBeVisible();
  }

  @step
  async connectWallet() {
    await this.connectWalletButton.click();
  }

  @step
  async shouldHaveShortAddress(
    shortAddress: ShortAddress = /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/,
  ) {
    await expect(this.connectedWalletButton).toHaveText(shortAddress);
  }

  /** Asserts the header shows `address` in its truncated `0x1234...abcd` form (case-insensitive) */
  @step
  async shouldShowConnectedAccount(address: string) {
    const [head, tail] = [address.slice(0, 6), address.slice(-4)];
    await this.shouldHaveShortAddress(new RegExp(`^${head}\\.\\.\\.${tail}$`, 'i'));
  }

  @step
  async openWalletFeatures() {
    await this.connectedWalletButton.click();
  }
}
