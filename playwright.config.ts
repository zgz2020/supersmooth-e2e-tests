import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers:
    process.env.WORKERS !== undefined
      ? Number(process.env.WORKERS) || 1
      : process.env.CI
        ? 1
        : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: `playwright-reports/${process.env.REPORT_FOLDER}` }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://aphelion-app.onrender.com/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/tests/api/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
