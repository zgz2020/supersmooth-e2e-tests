import type { Locator, Page } from '@playwright/test';
import { expect, step } from '../fixtures';

export class ProductsTopNavigation {
  readonly page: Page;
  readonly earnLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.earnLocator = this.page.getByRole('link', {
      name: /.*Earn.*(?:Strategies|Yield Loops).*/,
    });
  }

  @step
  async open(
    productPage:
      | 'Borrow'
      | 'Earn'
      | 'Earn - Passive Strategies'
      | 'Earn - Automated Strategies'
      | 'Earn - Yield Loops'
      | 'Multiply'
      | 'Trade',
  ) {
    if (['Borrow', 'Multiply', 'Trade'].includes(productPage)) {
      await this.page.getByRole('link', { name: productPage, exact: true }).click();
    } else if (productPage === 'Earn') {
      await this.earnLocator.click();
    } else {
      await expect(async () => {
        // Loop needed to avoid flakiness for menu
        await this.earnLocator.hover();
        await this.page.getByRole('menuitem', { name: productPage.replace('Earn - ', '') }).click();
      }).toPass();
    }
  }

  @step
  async shouldHaveEarnTag(tag: 'Passive Strategies' | 'Automated Strategies' | 'Yield Loops') {
    await expect(this.earnLocator.getByText(tag, { exact: true })).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  }
}
