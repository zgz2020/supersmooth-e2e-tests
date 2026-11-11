import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { normalizeBaseUrl } from './utils/constants/urls';
import { TIMEOUTS } from './utils/constants/timeouts';

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
  timeout: TIMEOUTS.staging.test,
  expect: {
    timeout: TIMEOUTS.staging.expect,
  },
  fullyParallel:
    process.env.FULLY_PARALLEL !== undefined ? process.env.FULLY_PARALLEL === 'true' : true,
  retries: process.env.RETRIES !== undefined ? Number(process.env.RETRIES) : process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  workers: process.env.WORKERS !== undefined ? Number(process.env.WORKERS) || 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: `playwright-reports/${process.env.REPORT_FOLDER}` }],
    ['json', { outputFile: 'test-results/results.json' }],
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
    actionTimeout: TIMEOUTS.staging.action,
    navigationTimeout: TIMEOUTS.staging.navigation,
  },
  projects: [
    {
      name: 'no-wallet',
      testDir: './tests/e2e/no-wallet',
      timeout: TIMEOUTS.staging.test,
      expect: {
        timeout: TIMEOUTS.staging.expect,
      },
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: TIMEOUTS.staging.action,
        navigationTimeout: TIMEOUTS.staging.navigation,
      },
    },
    {
      name: 'with-wallet',
      testDir: './tests/e2e/with-wallet',
      timeout: TIMEOUTS.withWallet.test,
      expect: {
        timeout: TIMEOUTS.withWallet.expect,
      },
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: TIMEOUTS.withWallet.action,
        navigationTimeout: TIMEOUTS.withWallet.navigation,
      },
    },
    {
      name: 'anvil',
      testDir: './tests/e2e/anvil',
      timeout: TIMEOUTS.anvil.test,
      expect: {
        timeout: TIMEOUTS.anvil.expect,
      },
      use: {
        ...devices['Desktop Chrome'],
        baseURL: normalizeBaseUrl(process.env.FORK_BASE_URL || 'http://localhost:3000'),
        actionTimeout: TIMEOUTS.anvil.action,
        navigationTimeout: TIMEOUTS.anvil.navigation,
      },
    },
    {
      name: 'api',
      testDir: './tests/api',
      testIgnore: ['**/complianceGeoFakeLocation.spec.ts'],
      timeout: TIMEOUTS.api.test,
      expect: {
        timeout: TIMEOUTS.api.expect,
      },
    },
    {
      name: 'api-regression',
      testDir: './tests/api',
      testIgnore: ['**/complianceGeoFakeLocation.spec.ts'],
      grepInvert: /@api_nightly/,
      timeout: TIMEOUTS.api.test,
      expect: {
        timeout: TIMEOUTS.api.expect,
      },
    },
    {
      name: 'api-fake-geo',
      testMatch: '**/complianceGeoFakeLocation.spec.ts',
      timeout: TIMEOUTS.api.test,
      expect: {
        timeout: TIMEOUTS.api.expect,
      },
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
