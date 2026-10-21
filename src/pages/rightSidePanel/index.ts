import { Page } from '@playwright/test';
import { ConfigurePosition } from './configurePosition.ts';

export class RightSidePanel {
  readonly page: Page;
  readonly configurePosition: ConfigurePosition;

  constructor(page: Page) {
    this.page = page;
    this.configurePosition = new ConfigurePosition(page);
  }
}
