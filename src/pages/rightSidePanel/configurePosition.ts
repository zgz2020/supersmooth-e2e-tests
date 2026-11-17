import { expect, Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import type { WaitToBeStableProps } from '../../../utils/types/e2e/common';

// Formatted positive amount (e.g. 0.00025, 5.6, 1,250.00) with at least one non-zero digit
const POSITIVE_AMOUNT = /^(?=.*[1-9])[\d,.]+$/;
// Same, as a USD value (e.g. $429.64)
const POSITIVE_USD_AMOUNT = /^\$(?=.*[1-9])[\d,.]+$/;

export class ConfigurePosition {
  readonly page: Page;
  readonly balanceLocator: Locator;
  readonly depositInputLocator: Locator;
  readonly tradeDepositInputLocator: Locator;
  readonly panelLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.getByTestId('right-side-panel');
    this.balanceLocator = this.panelLocator.getByTestId(/^input-box-deposit-[\w-]*balance$/);
    this.depositInputLocator = this.panelLocator.getByTestId(/^input-box-deposit-[\w-]*input$/);
    // Trade (perp/spot) pages: "Add Funds" deposit box. The amount input has no test id, and the
    // panel also holds the order-size input (size-input-field), so scope to the Add Funds card.
    this.tradeDepositInputLocator = this.panelLocator
      .getByTestId('hyperliquid-add-funds')
      .getByRole('textbox');
  }

  @step
  async waitToBeStable({ collateral, trade, withBalance, position, timeout }: WaitToBeStableProps) {
    const timeoutOption = timeout !== undefined ? { timeout } : undefined;
    if (position) {
      // Existing position page: the panel's Liquidation Price shows once the position data loaded
      await expect(this.panelLocator.getByTestId('liquidation-slider-price')).toHaveText(
        POSITIVE_USD_AMOUNT,
        timeoutOption,
      );
    } else if (withBalance) {
      await expect(this.balanceLocator).toHaveText(POSITIVE_AMOUNT, timeoutOption);
    } else if (trade) {
      await expect(
        this.panelLocator.getByRole('button', { name: 'Deposit from Base' }),
      ).toBeVisible(timeoutOption);
    } else {
      await expect(
        this.panelLocator.getByTestId(/^input-box-deposit.*token-selector$/),
      ).toContainText(collateral, timeoutOption);
    }
  }

  @step
  async setDeposit(amount: string, { trade = false }: { trade?: boolean } = {}) {
    await (trade ? this.tradeDepositInputLocator : this.depositInputLocator).fill(amount);
  }

  @step
  async shouldHaveDepositValue(expected: string) {
    await expect(this.depositInputLocator).toHaveValue(expected);
  }

  @step
  async shouldShowPositiveDepositBalance() {
    await expect(this.balanceLocator).toHaveText(POSITIVE_AMOUNT);
  }

  @step
  async setBorrow(amount: string) {
    await this.panelLocator.getByLabel('Borrow').fill(amount);
  }

  @step
  async openPosition() {
    await this.panelLocator
      .getByRole('button', { name: /^(Open Position|Deposit|Deposit from Base)$/ })
      .click();
  }

  @step
  async connectWallet() {
    await this.panelLocator.getByRole('button', { name: 'Connect Wallet' }).click();
  }
}
