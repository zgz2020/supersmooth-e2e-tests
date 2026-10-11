import { Page } from '@playwright/test';
import { step } from '../fixtures';
import { RightSidePanel } from './rightSidePanel';
import type { Token } from '../../utils/types/e2e/common.js';

export class PositionPage {
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
}
