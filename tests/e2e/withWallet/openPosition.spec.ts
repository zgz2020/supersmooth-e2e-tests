import { test } from '../../../src/fixtures/base';
import { openPosition } from '../../../utils/openPosition.js';

test.describe('Open position - Multiply on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Aave V3 ETH/USDC position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    await app.vaultPage.openPage(
      '/products/multiply/aaveV3/8453/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5-0x4200000000000000000000000000000000000006-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      { collateral: 'ETH' },
    );

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

  test('It should open Morpho ETH/USDC position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    await app.vaultPage.openPage(
      '/products/borrow/morpho/8453/0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
      { collateral: 'ETH' },
    );

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

  test('It should open Morpho WstETH/ETH position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    await app.vaultPage.openPage(
      '/products/yield-loop/morpho/8453/0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba',
      { collateral: 'wstETH' },
    );

    await openPosition({
      app,
      positionType: 'Earn',
      depositAmount: '0.00025',
    });

    await metamask.rejectTransaction();
  });
});
