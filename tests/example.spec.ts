import { test, expect } from '../fixtures/index.js';

test('navigates to web app baseURL', async ({ appPage }) => {
  await expect(appPage).toHaveURL(/aphelion-app\.onrender\.com/);
});

test('web app page loads body element', async ({ appPage }) => {
  await expect(appPage.locator('body')).toBeVisible();
});
