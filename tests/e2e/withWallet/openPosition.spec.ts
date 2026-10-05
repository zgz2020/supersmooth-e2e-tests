import { test } from '../../../src/fixtures/base';

test.describe('Open position - Aave V3 on Base', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
  });

  test('It should open Multiply position - until rejecting first transaction', async ({
    app,
    metamask,
  }) => {
    await app.vaultPage.openPage(
      'products/multiply/aaveV3/8453/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5-0x4200000000000000000000000000000000000006-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      { collateral: 'ETH' },
    );

    await app.vaultPage.shouldBeVisible();

    await app.vaultPage.rightSidePanel.configurePosition.setDeposit('0.00025');
    await app.vaultPage.rightSidePanel.configurePosition.openPosition();

    await metamask.rejectTransaction();
  });
});
