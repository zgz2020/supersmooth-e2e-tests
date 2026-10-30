import { test } from '../../../src/fixtures/base';
import { openPosition } from '../../../utils/openPosition';
import { getActiveVault } from '../../../utils/getActiveVault';

test.describe('Open position - Multiply on Base @regression', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Multiply position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    const { url } = await getActiveVault(app.page.request, 'multiply', {
      network: 'Base',
      collateral: 'ETH',
    });

    await app.vaultPage.openPage(url, { withBalance: true });

    await openPosition({
      app,
      positionType: 'Multiply',
      depositAmount: '0.00025',
    });

    await metamask.rejectTransaction();
  });
});

test.describe('Open position - Borrow on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Borrow position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    const { url } = await getActiveVault(app.page.request, 'borrow', {
      network: 'Base',
      collateral: 'ETH',
    });

    await app.vaultPage.openPage(url, { withBalance: true });

    await openPosition({
      app,
      positionType: 'Borrow',
      depositAmount: '0.00025',
      borrowAmount: '0.2',
    });

    await metamask.rejectTransaction();
  });
});

test.describe('Open position - Earn (Yield Loop) on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Yield Loop position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    const { url } = await getActiveVault(app.page.request, 'yieldLoop', {
      network: 'Base',
      collateral: 'wstETH',
    });

    await app.vaultPage.openPage(url, { withBalance: true });

    await openPosition({
      app,
      positionType: 'Earn',
      depositAmount: '0.00025',
    });

    await metamask.rejectTransaction();
  });
});

test.describe('Open position - Earn (Passive Strategy) on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Passive Strategy position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    const { url } = await getActiveVault(app.page.request, 'earn', {
      network: 'Base',
      protocols: 'coinbase',
      collateral: 'cbETH',
    });

    await app.vaultPage.openPage(url, { withBalance: true });

    await openPosition({
      app,
      positionType: 'Earn',
      depositAmount: '0.00025',
    });

    await metamask.rejectTransaction();
  });
});

test.describe('Open position - Earn (Automated Strategy) on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Automated Strategy position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    const { url } = await getActiveVault(app.page.request, 'earn', {
      network: 'Base',
      protocols: 'morpho',
      collateral: 'USDC',
    });

    await app.vaultPage.openPage(url, { withBalance: true });

    await openPosition({
      app,
      positionType: 'Earn',
      depositAmount: '0.5',
    });

    await metamask.rejectTransaction();
  });
});

test.describe('Open position - Trade (Perpetual Contracts) on HyperEVM (Deposit from Base)', () => {
  test.skip(
    !!process.env.CI,
    'Skipped in CI: Perpetual contracts are geo-blocked on US GitHub Actions runners',
  );

  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open XYZ100/USDC perp - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    await app.perpAndSpotPage.openPage('/products/perps/hyper/999/xyz%3AXYZ100');

    await openPosition({
      app,
      positionType: 'Trade',
      depositAmount: '5',
    });

    await metamask.rejectTransaction();
  });
});

test.describe('Open position - Trade (Spot Exchange) on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open uBTC/USDC trade - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    await app.perpAndSpotPage.openPage('/products/spot/hyper/999/ubtc-usdc');

    await openPosition({
      app,
      positionType: 'Trade',
      depositAmount: '5',
    });

    await metamask.rejectTransaction();
  });
});
