import { test, type Page } from '@playwright/test';
import {
  Borrow,
  Earn,
  Header,
  LandingPage,
  Migrate,
  Multiply,
  PositionPage,
  TradePage,
  VaultPage,
} from './pages';
import { Modals } from './modals';

export class App {
  readonly page: Page;
  readonly borrow: Borrow;
  readonly earn: Earn;
  readonly header: Header;
  readonly landingPage: LandingPage;
  readonly modals: Modals;
  readonly migrate: Migrate;
  readonly multiply: Multiply;
  readonly positionPage: PositionPage;
  readonly tradePage: TradePage;
  readonly vaultPage: VaultPage;

  constructor(page: Page) {
    this.page = page;
    this.borrow = new Borrow(page);
    this.earn = new Earn(page);
    this.header = new Header(page);
    this.landingPage = new LandingPage(page);
    this.migrate = new Migrate(page);
    this.modals = new Modals(page);
    this.multiply = new Multiply(page);
    this.positionPage = new PositionPage(page);
    this.tradePage = new TradePage(page);
    this.vaultPage = new VaultPage(page);
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
