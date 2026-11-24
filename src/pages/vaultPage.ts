import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../fixtures';
import { defaultExpectTimeout } from '../../utils/constants/timeouts';
import { RightSidePanel } from './rightSidePanel';
import type { Token } from '../../utils/types/e2e/common';

// Formatted positive price (e.g. 1,667.04, or a pair price such as 1.1377 cbETH/WETH)
const POSITIVE_PRICE = /^(?=[^ ]*[1-9])[\d,.]+/;

export class VaultPage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;
  /** The header's collateral price ("Wrapped Ether Market Price  1,667.04"), the value only */
  readonly marketPriceLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
    this.marketPriceLocator = page
      .getByText(/ Market Price$/)
      .first()
      .locator('xpath=following-sibling::div[1]/p[1]');
  }

  @step
  async openPage(
    url: string,
    args?: { collateral?: Token; withBalance?: boolean; timeout?: number },
  ) {
    await this.page.goto(url);
    if (args?.withBalance) {
      await this.rightSidePanel.configurePosition.waitToBeStable({
        withBalance: true,
        timeout: args.timeout,
      });
    } else if (args?.collateral) {
      await this.rightSidePanel.configurePosition.waitToBeStable({
        collateral: args.collateral,
        timeout: args.timeout,
      });
    }
  }

  /**
   * The vault's data has loaded: the header shows the collateral's market price. Until the page's
   * chain data loads (through the browser's RPC), the whole page, header included, is a skeleton.
   * Unlike the deposit balance, it does not depend on the wallet's balances loading.
   */
  @step
  async shouldShowMarketPrice(args?: { timeout?: number }) {
    await expect(this.marketPriceLocator, 'the market price should show').toHaveText(
      POSITIVE_PRICE,
      args,
    );
  }

  /**
   * The vault's data has not loaded: no market price in the header. While the page is a skeleton
   * the element does not exist, so this counts prices instead of reading one (`not.toHaveText`
   * would wait for the element and time out): none may show a positive price.
   */
  @step
  async shouldNotShowMarketPrice() {
    await expect(
      this.marketPriceLocator.filter({ hasText: POSITIVE_PRICE }),
      'the market price should not show yet',
    ).toHaveCount(0);
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Configure position')).toBeVisible({
      timeout: defaultExpectTimeout * 3,
    });
  }
}
