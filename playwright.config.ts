import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { normalizeBaseUrl } from './utils/constants/urls';

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
  testIgnore: ['**/tests/performance/**'],
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
    baseURL: normalizeBaseUrl(process.env.BASE_URL),
    headless: process.env.HEADLESS ? true : false,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'no-wallet',
      testDir: './tests/e2e/no-wallet',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'with-wallet',
      testDir: './tests/e2e/with-wallet',
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
    {
      name: 'firefox',
      testDir: './tests/e2e/no-wallet-cross-browser',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testDir: './tests/e2e/no-wallet-cross-browser',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-safari',
      testDir: './tests/e2e/no-wallet-cross-browser',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'mobile-android',
      testDir: './tests/e2e/no-wallet-cross-browser',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'tablet-ipad',
      testDir: './tests/e2e/no-wallet-cross-browser',
      use: { ...devices['iPad Pro 11'] },
    },
    {
      name: 'desktop-large',
      testDir: './tests/e2e/no-wallet-cross-browser',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
