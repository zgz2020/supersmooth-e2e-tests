import { expect, type Page } from '@playwright/test';
import { step } from '../fixtures';
import { defaultExpectTimeout } from '../../utils/constants/timeouts';
import { RightSidePanel } from './rightSidePanel';
import type { Token } from '../../utils/types/e2e/common';

export class VaultPage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
  }

  @step
  async openPage(
    url: string,
    args?: { collateral?: Token; withBalance?: boolean; timeout?: number },
  ) {
    await this.page.goto(url);
    if (args?.withBalance) {
      await this.rightSidePanel.configurePosition.waitToBeStable({
        withBalance: true,
        timeout: args.timeout,
      });
    } else if (args?.collateral) {
      await this.rightSidePanel.configurePosition.waitToBeStable({
        collateral: args.collateral,
        timeout: args.timeout,
      });
    }
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Configure position')).toBeVisible({
      timeout: defaultExpectTimeout * 3,
    });
  }
}
