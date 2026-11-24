import { test } from '../../../src/fixtures/base';
import { approx } from '../../../utils/amount';
import { TEST_WALLET_POSITIONS } from '../../../utils/constants/positions';
import { tc } from '../../../utils/testCase';

/**
 * aphelion-app#1690: a position's Net Value read ~$0 while closing it paid out over $13. The test
 * wallet holds a single small position, so this only covers Aave v3 Multiply on Base; see the
 * E2E-MPOS-003 notes for how to widen it.
 */
test.describe('Position Net Value - Multiply on Base @regression', () => {
  test.beforeEach(async ({ app }, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
    await app.positionPage.openPage(TEST_WALLET_POSITIONS.multiplyAaveV3WethUsdcBase, {
      position: true,
    });
    await app.positionPage.shouldShowOpenPosition();
  });

  test(
    'Net Value should match what closing the position to its debt token pays out',
    tc('E2E-MPOS-003'),
    async ({ app }) => {
      // Read before opening Close: the overview then switches to the projected (zero) values
      const { netValueUsd } = await app.positionPage.getOverviewValues();

      await app.positionPage.rightSidePanel.closePosition.open();
      await app.positionPage.rightSidePanel.closePosition.selectCloseTo('USDC');
      // Closing to USDC pays the net value in USDC (~$1), less the 30 bps fee and swap slippage
      await app.positionPage.rightSidePanel.closePosition.shouldReceiveAmount(
        approx(netValueUsd, { relative: 0.05, min: 0.05 }),
        `USDC received on close (overview Net Value $${netValueUsd})`,
      );
    },
  );
});
