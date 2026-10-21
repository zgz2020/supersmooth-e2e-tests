import { expect, type Page } from '@playwright/test';
import { step } from '../fixtures/index.ts';
import { defaultExpectTimeout } from '../../utils/constants/timeouts.ts';
import { RightSidePanel } from './rightSidePanel/index.ts';
import type { Token } from '../../utils/types/e2e/common.ts';

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
    await this.rightSidePanel.configurePosition.waitToBeStable({ collateral });
  }

  @step
  async shouldBeVisible() {
    await expect(this.page.getByText('Configure position')).toBeVisible({
      timeout: defaultExpectTimeout * 3,
    });
  }
}
