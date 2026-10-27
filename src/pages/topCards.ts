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
    // TODO: Scope tabList or add aria-label/data-testid in app code so a second tablist won't fail strict mode (see docs/TODO.md)
    this.tabList = page.getByRole('tablist');
    // TODO: Replace brittle XPath/class selector once data-testid='top-card' is added in app code (see docs/TODO.md)
    this.cards = this.tabList
      .locator('xpath=ancestor::div[contains(@class, "items-start")][1]')
      .locator('a[href^="/products/"]');
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
}
