import { test as base, expect, type Page } from '@playwright/test';

type AppFixtures = {
  /**
   * Custom fixture that automatically opens the web app at baseURL
   * before passing the page instance to the test.
   */
  appPage: Page;
};

export const test = base.extend<AppFixtures>({
  appPage: async ({ page, baseURL }, use) => {
    const url = baseURL || '/';
    await page.goto(url);
    await use(page);
  },
});

export { expect };
