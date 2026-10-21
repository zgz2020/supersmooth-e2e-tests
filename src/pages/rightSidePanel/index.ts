import { Page } from '@playwright/test';
import { ConfigurePosition } from './configurePosition';

export class RightSidePanel {
  readonly page: Page;
  readonly configurePosition: ConfigurePosition;

  constructor(page: Page) {
    this.page = page;
    this.configurePosition = new ConfigurePosition(page);
  }
}
