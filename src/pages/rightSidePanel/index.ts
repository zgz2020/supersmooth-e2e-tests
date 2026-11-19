import { Page } from '@playwright/test';
import { AdjustPosition } from './adjustPosition';
import { ClosePosition } from './closePosition';
import { ConfigurePosition } from './configurePosition';

export class RightSidePanel {
  readonly page: Page;
  readonly adjustPosition: AdjustPosition;
  readonly closePosition: ClosePosition;
  readonly configurePosition: ConfigurePosition;

  constructor(page: Page) {
    this.page = page;
    this.adjustPosition = new AdjustPosition(page);
    this.closePosition = new ClosePosition(page);
    this.configurePosition = new ConfigurePosition(page);
  }
}
