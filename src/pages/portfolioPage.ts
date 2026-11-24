import { expect, Locator, Page } from '@playwright/test';
import { step } from '../fixtures';
import { expectAmount, parseAmount } from '../../utils/amount';

/** Where `/api/portfolio/safes` sourced a position: the indexer, or the app's on-chain fallback. */
type PositionSource = 'indexer' | 'onchain-recovery';

/** `/portfolio/<wallet>`: one card per position, each linking to its position page. */
export class PortfolioPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Opens the wallet's portfolio; returns the source of each position the page loaded. */
  @step
  async openPage(wallet: string): Promise<PositionSource[]> {
    const safesResponse = this.page.waitForResponse((response) =>
      response.url().includes('/api/portfolio/safes'),
    );
    await this.page.goto(`/portfolio/${wallet}`);
    const response = await safesResponse;
    // Matched on the URL only, so an error status fails here with its code instead of timing out
    expect(response.status(), `${response.url()} should succeed`).toBe(200);
    return positionSources(await response.json());
  }

  /**
   * Opens the portfolio and checks its positions came from the indexer. The app falls back to
   * reading the chain when the indexer has nothing, which would hide an indexer failure.
   */
  @step
  async openPageShouldUseIndexer(wallet: string, positions = 1) {
    expect(
      await this.openPage(wallet),
      `the portfolio API should source the wallet's ${positions} position(s) from the indexer`,
    ).toEqual(Array(positions).fill('indexer'));
  }

  /** The card of the position held by `safe` (its link ends in the Safe address). */
  positionCard(safe: string): Locator {
    return this.page.locator(`a[href$="/${safe}" i]`);
  }

  /** Value of a stat on a position card, e.g. `Net Value` → `$2,411`. */
  private cardStat(safe: string, title: string): Locator {
    return this.positionCard(safe)
      .getByText(title, { exact: true })
      .locator('xpath=ancestor::div[contains(@class, "pb-1")][1]/following-sibling::div[1]');
  }

  @step
  async shouldShowPosition(safe: string, args?: { timeout?: number }) {
    await expect(
      this.positionCard(safe),
      `portfolio should list the position held by Safe ${safe}`,
    ).toBeVisible(args);
  }

  /** The position page URL the card links to (the app builds it; no API returns it). */
  @step
  async getPositionUrl(safe: string): Promise<string> {
    const href = await this.positionCard(safe).getAttribute('href');
    expect(href, `Portfolio card of Safe ${safe} should link to its position page`).toBeTruthy();
    return href!;
  }

  /** Opens the position page from its card, as a user would (the card links to the page). */
  @step
  async openPosition(safe: string) {
    await this.positionCard(safe).click();
  }

  /**
   * A card stat in USD, read once: the card is built from the `/api/portfolio/safes` response that
   * `openPage` waits for, so it is final as soon as the card shows. Portfolio only lists open,
   * non-empty positions, so a stat without a number (`—`) fails right away.
   */
  private async cardStatUsd(safe: string, title: string): Promise<number> {
    const text = await this.cardStat(safe, title).innerText();
    const usd = parseAmount(text);
    expect(
      usd,
      `Portfolio card of Safe ${safe} should show a number for ${title}, not "${text}"`,
    ).not.toBeNaN();
    return usd;
  }

  /** A Borrow card's `Coll. Locked` and `Total Debt`, in whole USD (`<$1` reads as 1). */
  @step
  async getBorrowAmountsUsd(safe: string): Promise<{ collateral: number; debt: number }> {
    return {
      collateral: await this.cardStatUsd(safe, 'Coll. Locked'),
      debt: await this.cardStatUsd(safe, 'Total Debt'),
    };
  }

  /** The card's Net Value, in whole USD. */
  @step
  async getNetValueUsd(safe: string): Promise<number> {
    return this.cardStatUsd(safe, 'Net Value');
  }

  /** The card shows `usd` as its Net Value; the card rounds to whole dollars, hence ±$1. */
  @step
  async shouldShowNetValue(safe: string, usd: number) {
    await expectAmount(
      this.cardStat(safe, 'Net Value'),
      { value: usd, tolerance: 1 },
      `portfolio Net Value of Safe ${safe}`,
    );
  }
}

/** Every `dataQuality.source` in a `/api/portfolio/safes` response, wherever it is nested. */
function positionSources(body: unknown): PositionSource[] {
  const sources: PositionSource[] = [];
  const collect = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') {
      const { dataQuality } = node as { dataQuality?: { source?: PositionSource } };
      if (dataQuality?.source) sources.push(dataQuality.source);
      Object.values(node).forEach(collect);
    }
  };
  collect(body);
  return sources;
}
