import { type Page } from '@playwright/test';
import { step } from '../fixtures/index.ts';
import { RightSidePanel } from './rightSidePanel/index.ts';

export class TradePage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
  }

  @step
  async openPage(url: string) {
    await this.page.goto(url);
    await this.rightSidePanel.configurePosition.waitToBeStable({ trade: true });
  }
}
