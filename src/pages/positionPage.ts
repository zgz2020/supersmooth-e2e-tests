import { expect, Locator, Page } from '@playwright/test';
import { step } from '../fixtures';
import { RightSidePanel } from './rightSidePanel';
import { approx, expectAmount, parseAmount, type ApproxAmount } from '../../utils/amount';
import type { WaitToBeStableProps } from '../../utils/types/e2e/common';
import type { Address } from 'viem';

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
  /**
   * What the app renders instead of a position: the route's own `Invalid market identifier: …` /
   * `Invalid position ID: …` message, or the app error page (always has `Report this error`).
   */
  readonly errorScreen: Locator;
  private readonly overviewFields: Record<keyof PositionOverviewValues, Locator>;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
    this.overviewLocator = this.page.getByRole('tabpanel', { name: 'Overview' });
    this.errorScreen = this.page
      .getByText(/Invalid (market identifier|position ID):/)
      .or(this.page.getByRole('button', { name: 'Report this error' }));
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

  /** Opens a position page by its URL, as when a user pastes or bookmarks it. */
  @step
  async goto(url: string) {
    await this.page.goto(url);
  }

  /**
   * The position page rendered its Position Overview instead of an error screen. Opening a
   * position fetches it on-chain server-side, which takes up to ~30 s on staging, so this waits
   * for whichever comes first and fails at once on an error screen instead of waiting it out.
   */
  @step
  async shouldShowPositionOverview({ timeout = 60_000 } = {}) {
    const overview = this.overviewLocator.getByText('Position Overview', { exact: true });
    await expect(
      overview.or(this.errorScreen).first(),
      'position page should finish loading (Position Overview or an error screen)',
    ).toBeVisible({ timeout });
    await expect(this.errorScreen, 'position page should not show an error screen').toHaveCount(0);
    await expect(overview, 'position page should show its Position Overview').toBeVisible();
  }

  /**
   * Matches the Portfolio card's figures (whole USD): Borrow `Collateral Locked` (`< 0.01 WETH
   * ($8.50)`) and `Borrowing` (`$1.01`). Within $1 (the card's rounding) or 2% (prices move
   * between pages); retries while the page values load.
   */
  @step
  async shouldShowBorrowAmounts(card: { collateral: number; debt: number }) {
    await expectAmount(
      this.overviewLocator
        .getByText('Collateral Locked', { exact: true })
        .locator('xpath=following-sibling::div[1]/p[last()]'),
      approx(card.collateral, { relative: 0.02, min: 1 }),
      'Collateral Locked (USD) should match the Portfolio card',
    );
    await expectAmount(
      this.overviewMetric('Borrowing'),
      approx(card.debt, { relative: 0.02, min: 1 }),
      'Borrowing (USD) should match the Portfolio card',
    );
  }

  /** Net Value matches the Portfolio card's (whole USD), within $1 or 2%; retries while loading. */
  @step
  async shouldShowNetValue(cardUsd: number) {
    await expectAmount(
      this.overviewFields.netValueUsd,
      approx(cardUsd, { relative: 0.02, min: 1 }),
      'Net Value should match the Portfolio card',
    );
  }

  /** The position has loaded and is still open (its net value is above zero). */
  @step
  async shouldShowOpenPosition(args?: { timeout?: number }) {
    await expect
      .poll(async () => parseAmount(await this.overviewFields.netValueUsd.innerText()), {
        message: 'Position Overview should show a net value above zero',
        ...args,
      })
      .toBeGreaterThan(0);
  }

  /**
   * Like {@link shouldShowOpenPosition}, reloading the page while it fails to load. On a fresh
   * fork Anvil fetches every slot it has not read yet from the upstream RPC, so the app server's
   * first reads for a new position can time out, and the page does not retry them. A user would
   * reload; a warm fork loads it on the first try.
   */
  @step
  async shouldLoadOpenPositionReloading({ attemptTimeout = 45_000, timeout = 180_000 } = {}) {
    let attempt = 0;
    await expect(async () => {
      if (attempt++ > 0) await this.page.reload();
      await this.shouldShowOpenPosition({ timeout: attemptTimeout });
    }, 'position page should load the open position (reloading on a cold fork)').toPass({
      timeout,
      intervals: [0],
    });
  }

  /** The Safe the page shows: the last path segment (ignoring any query, hash or trailing slash). */
  @step
  async getSafeAddress(): Promise<Address> {
    const safePath = /\/(0x[0-9a-fA-F]{40})\/?(?:[?#].*)?$/;
    await expect(this.page, 'position page path should end in a Safe address').toHaveURL(safePath);
    return this.page.url().match(safePath)![1] as Address;
  }

  /**
   * The overview shows the position the chain holds: exposure in collateral tokens and debt in USD
   * within 1% (interest accrues every block, and the app may price the debt from another feed),
   * and a multiple above 1x.
   */
  @step
  async shouldMatchPosition(position: { collateral: number; debtUsd: number }) {
    await this.shouldHaveOverviewValues({
      totalExposure: approx(position.collateral, { relative: 0.01 }),
      positionDebtUsd: approx(position.debtUsd, { relative: 0.01 }),
    });
    expect(
      parseAmount(await this.overviewFields.multiple.innerText()),
      'position multiple should be above 1x',
    ).toBeGreaterThan(1);
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
