import { test, expect } from '../src/fixtures/index.js';
import { Multiply } from '../src/pages/index.js';

test('navigates to web app baseURL', async ({ app }) => {
  await expect(app.page).toHaveURL(/aphelion-app\.onrender\.com/);
});

test('web app page loads body element', async ({ app }) => {
  await expect(app.page.locator('body')).toBeVisible();
  await app.pause();
});

test('opens multiply page', async ({ page }) => {
  const multiply = new Multiply(page);
  await multiply.open();
  await multiply.shouldBeOpened();
});
