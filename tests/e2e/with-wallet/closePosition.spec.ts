import { test } from '../../../src/fixtures/base';
import { TEST_WALLET_POSITIONS } from '../../../utils/constants/positions';
import { tc } from '../../../utils/testCase';

test.describe('Close position - Multiply on Base', () => {
  test.beforeEach(async ({ app }, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
    await app.positionPage.openPage(TEST_WALLET_POSITIONS.multiplyAaveV3WethUsdcBase, {
      position: true,
    });
    await app.positionPage.shouldShowOpenPosition();
  });

  test(
    'It should close Multiply position - until rejecting first transaction',
    tc('E2E-MPOS-001'),
    async ({ app, metamask }) => {
      // Read before opening Close: the overview then switches to the projected (zero) values
      const overview = await app.positionPage.getOverviewValues();
      const closePosition = app.positionPage.rightSidePanel.closePosition;

      await closePosition.open();
      await closePosition.shouldHaveCloseToSelected('ETH');
      await closePosition.shouldReceive('< 0.01 ETH');

      await closePosition.shouldHaveFee(/^30 bps/);
      await closePosition.shouldHaveChange('Outstanding debt', {
        from: overview.positionDebtUsd, // USDC debt vs its USD value: allow 2% (min 1 cent)
        tolerance: Math.max(0.01, overview.positionDebtUsd * 0.02),
        to: '0.00 USDC',
      });
      await closePosition.shouldHaveChange('Total collateral', {
        from: overview.totalExposure, // both shown with 4 decimals
        tolerance: 0.0001,
        to: '0.00 WETH',
      });
      await closePosition.shouldHaveChange('Withdrawable collateral', {
        from: overview.availableToWithdraw,
        tolerance: 0.0001,
        to: '0.00 WETH',
      });

      await closePosition.closePosition();

      await metamask.rejectTransaction();
    },
  );
});
