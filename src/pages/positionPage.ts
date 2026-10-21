import { Page } from '@playwright/test';
import { step } from '../fixtures/index.ts';
import { RightSidePanel } from './rightSidePanel/index.ts';
import type { WaitToBeStableProps } from '../../utils/types/e2e/common.ts';

export class PositionPage {
  readonly page: Page;
  readonly rightSidePanel: RightSidePanel;

  constructor(page: Page) {
    this.page = page;
    this.rightSidePanel = new RightSidePanel(page);
  }

  @step
  async openPage(url: string, props: WaitToBeStableProps) {
    await this.page.goto(url);
    await this.rightSidePanel.configurePosition.waitToBeStable(props);
  }
}
