import { test, expect } from '../fixtures/index.js';

test('has title using web app fixture', async ({ appPage }) => {
  await expect(appPage).toHaveTitle(/Playwright/);
});

test('get started link using web app fixture', async ({ appPage }) => {
  await appPage.getByRole('link', { name: 'Get started' }).click();
  await expect(appPage.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
