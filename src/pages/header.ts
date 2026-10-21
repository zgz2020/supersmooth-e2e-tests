import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures/index.ts';
import type { Address } from '../../utils/types/api/common.ts';

type ShortAddress = Address | RegExp;
type LandingPageMenuOptions = 'Earn' | 'Borrow' | 'Multiply';
type AppMenuOptions = 'Products' | 'Portfolio' | 'Migrate';

export class Header {
  readonly page: Page;
  readonly headerLocator: Locator;
  readonly connectedWalletButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerLocator = page.getByRole('navigation').first();
    this.connectedWalletButton = this.headerLocator.getByRole('button', {
      name: /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/,
    });
  }

  @step
  async shouldBeVisible() {
    await expect(this.headerLocator).toBeVisible();
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
  async connectWallet() {
    await this.headerLocator.getByRole('button', { name: 'Connect Wallet' }).click();
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
