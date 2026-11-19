import { expect, Locator, Page } from '@playwright/test';
import { step } from '../fixtures';
import { RightSidePanel } from './rightSidePanel';
import { expectAmount, parseAmount, type ApproxAmount } from '../../utils/amount';
import type { WaitToBeStableProps } from '../../utils/types/e2e/common';

export type PositionOverviewValues = {
  multiple: number;
  liquidationPrice: number;
  /** Loan to Value, in percent (e.g. 20.09) */
  ltv: number;
  /** Total collateral exposure, in the collateral token (e.g. `Total WETH Exposure`) */
  totalExposure: number;
  netValueUsd: number;
  positionDebtUsd: number;
  availableToWithdraw: number;
};

export class PositionPage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;
  readonly overviewLocator: Locator;
  private readonly overviewFields: Record<keyof PositionOverviewValues, Locator>;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
    this.overviewLocator = this.page.getByRole('tabpanel', { name: 'Overview' });
    this.overviewFields = {
      multiple: this.overviewLocator
        .getByText('Multiple', { exact: true })
        .locator('xpath=following-sibling::span[1]'),
      liquidationPrice: this.overviewMetric('Liquidation Price'),
      ltv: this.overviewMetric('Loan to Value'),
      totalExposure: this.overviewMetric(/^Total \S+ Exposure$/),
      netValueUsd: this.overviewValue('Net Value'),
      positionDebtUsd: this.overviewValue('Position Debt'),
      availableToWithdraw: this.overviewValue('Available to Withdraw'),
    };
  }

  /** Value next to a label in Position Overview, e.g. `Net Value` → `$1.33`. */
  private overviewValue(label: string): Locator {
    return this.overviewLocator
      .getByText(label, { exact: true })
      .locator('xpath=following-sibling::p[1]');
  }

  /** Headline metric (Liquidation Price, Loan to Value, Exposure): label and value are sibling blocks. */
  private overviewMetric(label: string | RegExp): Locator {
    return this.overviewLocator
      .getByText(label, { exact: true })
      .locator('xpath=ancestor::div[1]/following-sibling::div[1]');
  }

  @step
  async openPage(url: string, props: WaitToBeStableProps) {
    await this.page.goto(url);
    await this.rightSidePanel.configurePosition.waitToBeStable(props);
  }

  /** The position has loaded and is still open (its net value is above zero). */
  @step
  async shouldShowOpenPosition() {
    await expect
      .poll(async () => parseAmount(await this.overviewFields.netValueUsd.innerText()), {
        message: 'Position Overview should show a net value above zero',
      })
      .toBeGreaterThan(0);
  }

  /**
   * Reads the Position Overview figures. Call it before changing the position in the side panel:
   * the overview then shows the projected values instead (e.g. all zero once Close is selected).
   */
  @step
  async getOverviewValues(): Promise<PositionOverviewValues> {
    const values = {} as PositionOverviewValues;
    for (const [field, locator] of Object.entries(this.overviewFields)) {
      values[field as keyof PositionOverviewValues] = parseAmount(await locator.innerText());
    }
    return values;
  }

  /** The overview switched to the projection of the change configured in the side panel. */
  @step
  async shouldShowSimulation() {
    await expect(
      this.overviewLocator.getByText('Next Position Simulation', { exact: true }),
    ).toBeVisible();
  }

  /** Checks overview figures, each within its tolerance (retries while the quote loads). */
  @step
  async shouldHaveOverviewValues(
    expected: Partial<Record<keyof PositionOverviewValues, ApproxAmount>>,
  ) {
    for (const [field, amount] of Object.entries(expected)) {
      await expectAmount(
        this.overviewFields[field as keyof PositionOverviewValues],
        amount,
        `Overview ${field}`,
      );
    }
  }
}
