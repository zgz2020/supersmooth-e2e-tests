import { Page } from '@playwright/test';
import { ClosePosition } from './closePosition';
import { ConfigurePosition } from './configurePosition';

export class RightSidePanel {
  readonly page: Page;
  readonly closePosition: ClosePosition;
  readonly configurePosition: ConfigurePosition;

  constructor(page: Page) {
    this.page = page;
    this.closePosition = new ClosePosition(page);
    this.configurePosition = new ConfigurePosition(page);
  }
}
