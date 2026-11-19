import { test } from '../../../src/fixtures/base';
import { approx } from '../../../utils/amount';
import type { PositionOverviewValues } from '../../../src/pages/positionPage';
import { TEST_WALLET_POSITIONS } from '../../../utils/constants/positions';
import { tc } from '../../../utils/testCase';

/** Percentage points added to the current LTV (e.g. 20% → 40%), well below the 81% max LTV. */
const LTV_INCREASE = 20;

/**
 * Expected position after moving the LTV to `targetLtv` (same net value, more debt and collateral):
 * multiple = 1 / (1 - LTV), and the liquidation price grows with the LTV.
 */
const projectAdjustedPosition = (current: PositionOverviewValues, targetLtv: number) => {
  const multiple = 1 / (1 - targetLtv / 100);
  return {
    multiple,
    ltv: targetLtv,
    liquidationPrice: (current.liquidationPrice * targetLtv) / current.ltv,
    positionDebtUsd: current.netValueUsd * (multiple - 1),
    totalExposure: (current.totalExposure * multiple) / current.multiple,
  };
};

test.describe('Adjust position - Multiply on Base @regression', () => {
  test.beforeEach(async ({ app }, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 35_000);
    await app.positionPage.openPage(TEST_WALLET_POSITIONS.multiplyAaveV3WethUsdcBase, {
      position: true,
    });
    await app.positionPage.shouldShowOpenPosition();
  });

  test(
    'It should adjust risk up on Multiply position - until rejecting first transaction',
    tc('E2E-MPOS-002'),
    async ({ app, metamask }) => {
      // Read before moving the slider: the overview then switches to the simulated values
      const current = await app.positionPage.getOverviewValues();

      await app.positionPage.rightSidePanel.adjustPosition.open();
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveSliderValues({
        liquidationPrice: approx(current.liquidationPrice, { relative: 0.01 }),
        multiple: approx(current.multiple, { min: 0.01 }),
        ltv: approx(current.ltv, { min: 0.1 }),
      });

      const targetLtv = Math.round(current.ltv) + LTV_INCREASE;
      const next = projectAdjustedPosition(current, targetLtv);
      await app.positionPage.rightSidePanel.adjustPosition.setLtv(targetLtv);

      // Slider shows the target; the quote-based figures below land within rounding of it
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveSliderValues({
        liquidationPrice: approx(next.liquidationPrice, { relative: 0.02 }),
        multiple: approx(next.multiple, { min: 0.01 }),
        ltv: approx(targetLtv, { min: 0.01 }),
      });

      const expectedNext = {
        multiple: approx(next.multiple, { min: 0.02 }),
        ltv: approx(targetLtv, { min: 0.5 }),
        liquidationPrice: approx(next.liquidationPrice, { relative: 0.02 }),
        // Tiny position: 4-decimal WETH and cent-rounded USD values need an absolute floor
        totalExposure: approx(next.totalExposure, { relative: 0.05, min: 0.0001 }),
        positionDebtUsd: approx(next.positionDebtUsd, { relative: 0.03, min: 0.02 }),
      };

      // Order Summary: borrow the extra debt in USDC and swap it into WETH
      const borrowUsd = approx(next.positionDebtUsd - current.positionDebtUsd, {
        relative: 0.05,
        min: 0.02,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveOrderLine('Borrowing', {
        token: 'USDC',
        usd: borrowUsd,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveOrderLine('Buying', {
        token: 'WETH',
        usd: borrowUsd,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveFee(/^30 bps/);

      // Position Changes & Details: current position → adjusted position
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveChange('Multiple', {
        from: approx(current.multiple, { min: 0.01 }),
        to: expectedNext.multiple,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveChange('LTV', {
        from: approx(current.ltv, { min: 0.1 }),
        to: expectedNext.ltv,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveChange('Liquidation price', {
        from: approx(current.liquidationPrice, { relative: 0.01 }),
        to: expectedNext.liquidationPrice,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveChange('Total collateral', {
        from: approx(current.totalExposure, { min: 0.0001 }),
        to: expectedNext.totalExposure,
      });
      await app.positionPage.rightSidePanel.adjustPosition.shouldHaveChange('Total debt', {
        from: approx(current.positionDebtUsd, { relative: 0.02, min: 0.01 }), // USDC vs its USD value
        to: expectedNext.positionDebtUsd,
      });

      // Overview simulation: same adjusted figures, net value unchanged apart from fees
      await app.positionPage.shouldShowSimulation();
      await app.positionPage.shouldHaveOverviewValues({
        ...expectedNext,
        netValueUsd: approx(current.netValueUsd, { relative: 0.02, min: 0.02 }),
      });

      await app.positionPage.rightSidePanel.adjustPosition.adjustPosition();
      await app.positionPage.rightSidePanel.adjustPosition.shouldBeAdjusting();

      await metamask.rejectTransaction();

      await app.positionPage.rightSidePanel.adjustPosition.shouldOfferRetry();
    },
  );
});
