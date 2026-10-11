import { expect, type Page } from '@playwright/test';
import { step } from '../fixtures';
import { defaultExpectTimeout } from '../../utils/constants/timeouts';
import { RightSidePanel } from './rightSidePanel';
import type { Token } from '../../utils/types/e2e/common.js';

export class VaultPage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
  }

  @step
  async openPage(url: string, { collateral }: { collateral: Token }) {
    await this.page.goto(url);
    await this.rightSidePanel.configurePosition.waitToBeStable({ token: collateral });
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Configure position')).toBeVisible({
      timeout: defaultExpectTimeout * 3,
    });
  }
}
