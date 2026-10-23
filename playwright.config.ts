import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config();

const isFakeGeoRun =
  process.env.LOCAL_GEO === 'true' ||
  process.argv.some(
    (arg) =>
      arg.includes('complianceGeoFakeLocation') ||
      arg.includes('fake-geo') ||
      arg.includes('fakeLocation'),
  );

export default defineConfig({
  globalSetup: './utils/globalSetup',
  testDir: './tests',
  fullyParallel:
    process.env.FULLY_PARALLEL !== undefined ? process.env.FULLY_PARALLEL === 'true' : true,
  retries: process.env.RETRIES !== undefined ? Number(process.env.RETRIES) : process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  workers: process.env.WORKERS !== undefined ? Number(process.env.WORKERS) || 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: `playwright-reports/${process.env.REPORT_FOLDER}` }],
  ],
  webServer: isFakeGeoRun
    ? {
        command: process.env.WEB_SERVER_COMMAND || 'node scripts/mock-compliance-server.js',
        url: 'http://localhost:3000/api/compliance/geo',
        reuseExistingServer: !process.env.CI,
        timeout: 30 * 1000,
      }
    : undefined,
  use: {
    baseURL: process.env.BASE_URL || 'https://staging.supersmooth.fi/',
    headless: process.env.HEADLESS ? true : false,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'noWallet',
      testDir: './tests/e2e/noWallet',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'withWallet',
      testDir: './tests/e2e/withWallet',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
      testIgnore: ['**/complianceGeoFakeLocation.spec.ts'],
    },
    {
      name: 'api-regression',
      testDir: './tests/api',
      testIgnore: ['**/complianceGeoFakeLocation.spec.ts'],
      grepInvert: /@api_nightly/,
    },
    {
      name: 'api-fake-geo',
      testMatch: '**/complianceGeoFakeLocation.spec.ts',
      use: {
        baseURL: 'http://localhost:3000',
      },
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
