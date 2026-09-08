import { test, type Page } from '@playwright/test';

export class App {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open(url: string = '/') {
    await this.page.goto(url);
  }

  async close() {
    await this.page.close();
  }

  async pause() {
    const testInfo = test.info();
    const isHeaded = testInfo ? (testInfo.project.use.headless === false || process.argv.includes('--headed')) : false;
    if (isHeaded) {
      await this.page.pause();
    }
  }
}


