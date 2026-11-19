import { expect, Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import { expectAmount, type ApproxAmount } from '../../../utils/amount';
import type { Token } from '../../../utils/types/e2e/common';

/** Values on top of the LTV slider: the current ones, or the target once the slider moved. */
export type AdjustSliderValues = {
  liquidationPrice: ApproxAmount;
  multiple: ApproxAmount;
  /** In percent (e.g. 40 for `40.00%`) */
  ltv: ApproxAmount;
};

type OrderLine = {
  token: Token;
  usd: ApproxAmount;
};

type AdjustChange = {
  /** Current value */
  from: ApproxAmount;
  /** Value after adjusting */
  to: ApproxAmount;
};

/** Adjust tab of the right side panel on a position page: change the risk (LTV) of the position. */
export class AdjustPosition {
  readonly page: Page;
  readonly panelLocator: Locator;
  readonly ltvSliderLocator: Locator;
  readonly actionButtonLocator: Locator;
  private readonly sliderValues: Record<keyof AdjustSliderValues, Locator>;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.getByTestId('right-side-panel');
    this.ltvSliderLocator = this.panelLocator.getByRole('slider', { name: 'LTV' });
    this.actionButtonLocator = this.panelLocator.getByTestId('sidebar-action-button');
    this.sliderValues = {
      liquidationPrice: this.panelLocator.getByTestId('liquidation-slider-price'),
      multiple: this.panelLocator.getByTestId('liquidation-slider-multiple'),
      ltv: this.panelLocator.getByTestId('liquidation-slider-ltv'),
    };
  }

  /** `Position Changes & Details` row value, shown as `<current> → <after adjusting>`. */
  private changeValues(label: string): Locator {
    return this.panelLocator
      .getByText('Position Changes & Details', { exact: true })
      .locator('xpath=following-sibling::div[1]')
      .getByText(label, { exact: true })
      .locator('xpath=following-sibling::div[1]/p');
  }

  /** `Order Summary` line, e.g. `Borrowing` → `0.54 USDC` and `0.54 USD`. */
  private orderLine(label: string) {
    const labelLocator = this.panelLocator
      .getByText('Order Summary', { exact: true })
      .locator('xpath=following-sibling::div[1]')
      .getByText(label, { exact: true });
    return {
      amount: labelLocator.locator('xpath=following-sibling::div[1]/p'),
      usd: labelLocator.locator('xpath=following-sibling::p[1]'),
    };
  }

  @step
  async open() {
    await this.panelLocator.getByRole('tab', { name: 'Adjust', exact: true }).click();
    await expect(
      this.panelLocator.getByRole('heading', { name: 'Update Position', exact: true }),
    ).toBeVisible();
  }

  @step
  async shouldHaveSliderValues(expected: AdjustSliderValues) {
    for (const [field, amount] of Object.entries(expected)) {
      await expectAmount(
        this.sliderValues[field as keyof AdjustSliderValues],
        amount,
        `Slider ${field}`,
      );
    }
  }

  /** Moves the LTV slider to `ltv` percent (whole number, the slider step is 1). */
  @step
  async setLtv(ltv: number) {
    await this.ltvSliderLocator.fill(String(ltv));
    await expect(this.ltvSliderLocator).toHaveValue(String(ltv));
  }

  @step
  async shouldHaveOrderLine(label: 'Borrowing' | 'Buying', { token, usd }: OrderLine) {
    const line = this.orderLine(label);
    await expect(line.amount).toContainText(token);
    await expectAmount(line.usd, usd, `${label} (USD)`);
  }

  @step
  async shouldHaveFee(expected: string | RegExp) {
    await expect(
      this.panelLocator
        .getByText('Supersmooth Fee', { exact: true })
        .locator('xpath=following-sibling::*[1]'),
    ).toHaveText(expected);
  }

  @step
  async shouldHaveChange(label: string, { from, to }: AdjustChange) {
    const values = this.changeValues(label);
    // `<current> → <after>`: both values must be rendered before reading them
    await expect(values).toHaveCount(2);
    await expectAmount(values.first(), from, `${label} (current)`);
    await expectAmount(values.last(), to, `${label} (after adjusting)`);
  }

  @step
  async adjustPosition() {
    await expect(this.actionButtonLocator).toHaveText('Adjust Position');
    await this.actionButtonLocator.click();
  }

  /** Step 2 of 2: the panel waits for the transaction to be confirmed in the wallet. */
  @step
  async shouldBeAdjusting() {
    await expect(this.panelLocator.getByTestId('step-indicator')).toContainText('2/2');
    await expect(
      this.panelLocator.getByText('Your position is being adjusted', { exact: false }),
    ).toBeVisible();
    // Step 2 renders its own button, without the sidebar-action-button test id
    await expect(
      this.panelLocator.getByRole('button', { name: 'Adjusting Position...', exact: true }),
    ).toBeDisabled();
  }

  /** After a rejected transaction: back on step 1 of 2, change still configured, retry offered. */
  @step
  async shouldOfferRetry() {
    await expect(this.panelLocator.getByTestId('step-indicator')).toContainText('1/2');
    await expect(this.actionButtonLocator).toHaveText('Retry adjustment');
    await expect(this.actionButtonLocator).toBeEnabled();
  }
}
