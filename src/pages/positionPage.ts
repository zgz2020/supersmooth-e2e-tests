import { expect, Locator, Page } from '@playwright/test';
import { step } from '../fixtures';
import { RightSidePanel } from './rightSidePanel';
import { parseAmount } from './amount';
import type { WaitToBeStableProps } from '../../utils/types/e2e/common';

export type PositionOverviewValues = {
  netValueUsd: number;
  positionDebtUsd: number;
  availableToWithdraw: number;
  /** Total collateral exposure, in the collateral token (e.g. `Total WETH Exposure`) */
  totalExposure: number;
};

export class PositionPage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;
  readonly overviewLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
    this.overviewLocator = this.page.getByRole('tabpanel', { name: 'Overview' });
  }

  /** Value next to a label in Position Overview, e.g. `Net Value` → `$1.33`. */
  private overviewValue(label: string): Locator {
    return this.overviewLocator
      .getByText(label, { exact: true })
      .locator('xpath=following-sibling::p[1]');
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
      .poll(async () => parseAmount(await this.overviewValue('Net Value').innerText()), {
        message: 'Position Overview should show a net value above zero',
      })
      .toBeGreaterThan(0);
  }

  /**
   * Reads the Position Overview figures. Call it before opening the Close tab: once Close is
   * selected, the overview shows the values projected after closing (all zero).
   */
  @step
  async getOverviewValues(): Promise<PositionOverviewValues> {
    const read = async (label: string) => parseAmount(await this.overviewValue(label).innerText());
    return {
      netValueUsd: await read('Net Value'),
      positionDebtUsd: await read('Position Debt'),
      availableToWithdraw: await read('Available to Withdraw'),
      // Laid out differently from the other figures: label and value are sibling blocks
      totalExposure: parseAmount(
        await this.overviewLocator
          .getByText(/^Total \S+ Exposure$/)
          .locator('xpath=ancestor::div[1]/following-sibling::div[1]')
          .innerText(),
      ),
    };
  }
}
