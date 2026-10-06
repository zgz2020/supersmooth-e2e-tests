import { test, type Page } from '@playwright/test';
import { Header, Multiply, PositionPage, VaultPage } from './pages';
import { Modals } from './modals';

export class App {
  readonly page: Page;
  readonly header: Header;
  readonly multiply: Multiply;
  readonly modals: Modals;
  readonly vaultPage: VaultPage;
  readonly positionPage: PositionPage;

  constructor(page: Page) {
    this.page = page;
    this.header = new Header(page);
    this.multiply = new Multiply(page);
    this.modals = new Modals(page);
    this.vaultPage = new VaultPage(page);
    this.positionPage = new PositionPage(page);
  }

  async open(url: string = '/products/multiply') {
    await this.page.goto(url);
  }

  async close() {
    await this.page.close();
  }

  async pause() {
    const testInfo = test.info();
    const isHeaded = testInfo
      ? testInfo.project.use.headless === false || process.argv.includes('--headed')
      : false;
    if (isHeaded) {
      await this.page.pause();
    }
  }
}
