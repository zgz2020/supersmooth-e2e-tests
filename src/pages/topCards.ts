import { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures';
import {
  PRODUCT_TOP_CARDS_TABS,
  type ProductTopCardsTabs,
} from '../../utils/types/e2e/productTopCards';
import type { TopCardsProductType } from '../../utils/types/api/productTableTopCards';

export class TopCards {
  readonly page: Page;
  readonly tabList: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabList = page.getByTestId('top-cards-tablist');
    this.cards = page.getByTestId('top-card');
  }

  tab(tabName: ProductTopCardsTabs): Locator {
    return this.tabList.getByRole('tab', { name: tabName });
  }

  @step
  async selectTab<T extends TopCardsProductType>(product: T, tabName: ProductTopCardsTabs<T>) {
    await this.tab(tabName).click();
  }

  @step
  async shouldHaveTabSelected<T extends TopCardsProductType>(
    product: T,
    tabName: ProductTopCardsTabs<T>,
  ) {
    await expect(this.tab(tabName)).toHaveAttribute('aria-selected', 'true');
  }

  @step
  async shouldNotHaveOtherTabsSelected<T extends TopCardsProductType>(
    product: T,
    selectedTab: ProductTopCardsTabs<T>,
  ) {
    const allTabs = PRODUCT_TOP_CARDS_TABS[product] as readonly ProductTopCardsTabs[];
    const otherTabs = allTabs.filter((tab) => tab !== selectedTab);
    for (const tabName of otherTabs) {
      await expect(this.tab(tabName)).toHaveAttribute('aria-selected', 'false');
    }
  }

  @step
  async shouldHaveCount(count: number = 4) {
    await expect(this.cards).toHaveCount(count);
  }

  @step
  async shouldHaveValidCardData({
    card,
    product,
  }: {
    card: Locator;
    product: TopCardsProductType;
  }) {
    // URL
    const productPath = product === 'yieldLoop' ? 'yield-loop' : product;
    const urlPattern = new RegExp(
      `^/products/${productPath}/[a-zA-Z0-9-]+/\\d+/0x[a-fA-F0-9]+(?:-0x[a-fA-F0-9]+)*$`,
    );
    await expect(card).toHaveAttribute('href', urlPattern);

    // Title
    await expect(card.getByTestId('top-card-title')).not.toBeEmpty();

    // Marketed value (APY %, Borrow Rate %, Max LTV %, or Multiply x)
    const marketedValuePattern =
      product === 'multiply' ? /^[-+]?\d{1,3}\.\d{2}[%x]$/ : /^[-+]?\d{1,3}\.\d{2}%$/;
    await expect(card.getByTestId('top-card-marketed-value')).toHaveText(marketedValuePattern);

    // Liquidity value
    await expect(card.getByTestId('top-card-footer-value')).toHaveText(/^\$\d+(\.\d+)?[BKM]$/);

    // Max Deposit - Yield Loop only
    if (product === 'yieldLoop') {
      await expect(card.getByTestId('top-card-max-deposit-value')).toHaveText(
        /^\d+(?:\.\d+)?[KM]?\s+[a-zA-Z]+$/,
      );

      await expect(card.getByTestId('top-card-max-deposit-sub-value')).toHaveText(
        /^\$\d+(?:\.\d+)?[KM]?$/,
      );
    }
  }

  @step
  async shouldHaveValidCards({ product }: { product: TopCardsProductType }) {
    for (const card of await this.cards.all()) {
      await this.shouldHaveValidCardData({ card, product });
    }
  }
}
