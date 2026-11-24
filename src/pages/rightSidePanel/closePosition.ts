import { expect, Locator, Page } from '@playwright/test';
import { step } from '../../fixtures';
import { expectAmount, type ApproxAmount } from '../../../utils/amount';
import type { Token } from '../../../utils/types/e2e/common';

type SummaryChange = {
  /** Expected current value, matched within `tolerance` (it can drift with interest and prices) */
  from: number;
  tolerance: number;
  /** Exact text of the value after closing, e.g. `0.00 USDC` */
  to: string;
};

/** Close tab of the right side panel on a position page. */
export class ClosePosition {
  readonly page: Page;
  readonly panelLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panelLocator = this.page.getByTestId('right-side-panel');
  }

  /** Value next to a label in the panel, e.g. `Supersmooth Fee` → `30 bps ($0.00)`. */
  private rowValue(label: string): Locator {
    return this.panelLocator
      .getByText(label, { exact: true })
      .locator('xpath=following-sibling::*[1]');
  }

  @step
  async open() {
    await this.panelLocator.getByRole('tab', { name: 'Close', exact: true }).click();
    await expect(
      this.panelLocator.getByRole('heading', { name: 'Close', exact: true }),
    ).toBeVisible();
  }

  @step
  async shouldHaveCloseToSelected(token: Token) {
    await expect(this.panelLocator.getByRole('tab', { name: token, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }

  @step
  async shouldReceive(expected: string | RegExp) {
    await expect(this.rowValue('You will receive')).toHaveText(expected);
  }

  /** Picks what the position is closed to, e.g. `USDC` (the debt token) or `ETH`. */
  @step
  async selectCloseTo(token: Token) {
    await this.panelLocator.getByRole('tab', { name: token, exact: true }).click();
    await this.shouldHaveCloseToSelected(token);
  }

  /** `You will receive` is within tolerance of `expected` (retries while the quote loads). */
  @step
  async shouldReceiveAmount(expected: ApproxAmount, label = 'You will receive') {
    await expectAmount(this.rowValue('You will receive'), expected, label);
  }

  @step
  async shouldHaveFee(expected: string | RegExp) {
    await expect(this.rowValue('Supersmooth Fee')).toHaveText(expected);
  }

  /**
   * Checks a `Position Changes & Details` row, shown as `<current> → <after closing>`.
   * Retries until the quote has loaded and the current value is within tolerance.
   */
  @step
  async shouldHaveChange(label: string, { from, tolerance, to }: SummaryChange) {
    const values = this.rowValue(label).locator('p');
    // `<current> → <after>`: both values must be rendered before reading them
    await expect(values).toHaveCount(2);
    await expectAmount(values.first(), { value: from, tolerance }, `${label} (current)`);
    await expect(values.last()).toHaveText(to);
  }

  @step
  async closePosition() {
    await this.panelLocator.getByRole('button', { name: 'Close Position', exact: true }).click();
  }
}
