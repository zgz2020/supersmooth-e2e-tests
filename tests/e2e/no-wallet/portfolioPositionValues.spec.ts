import { test } from '../../../src/fixtures';
import { knownAppBugIf, type KnownAppBug } from '../../../src/fixtures/knownAppBug';
import { getOpenPositions, type IndexerProtocol } from '../../../utils/getOpenPositions';
import { tc } from '../../../utils/testCase';

interface PositionKind {
  protocol: IndexerProtocol;
  /** Open app bug that makes the portfolio card disagree with the position page */
  knownBug?: KnownAppBug;
}

const PORTFOLIO_VALUES_MISMATCH = {
  issue: 'https://github.com/Aphelion-Co/aphelion-app/issues/1689',
  reason: 'Portfolio Borrow cards show different collateral and debt than the position page',
};

const MULTIPLY_NET_VALUE_MISMATCH = {
  issue: 'https://github.com/Aphelion-Co/aphelion-app/issues/1689',
  reason: 'Portfolio Multiply cards show a different Net Value than the position page',
};

/** Every Multiply protocol; a protocol with no open Multiply position right now is skipped. */
const multiplyKinds: PositionKind[] = [
  { protocol: 'AaveV3', knownBug: MULTIPLY_NET_VALUE_MISMATCH },
  { protocol: 'AaveV3Lido', knownBug: MULTIPLY_NET_VALUE_MISMATCH },
  {
    protocol: 'CompoundV3',
    knownBug: {
      issue: 'https://github.com/Aphelion-Co/aphelion-app/issues/1690',
      reason: 'Compound V3 Multiply position page shows a Net Value of ~$0',
    },
  },
  { protocol: 'EulerV2' },
  { protocol: 'Fluid', knownBug: MULTIPLY_NET_VALUE_MISMATCH },
  { protocol: 'Morpho', knownBug: MULTIPLY_NET_VALUE_MISMATCH },
  { protocol: 'Spark' },
];

/** Every Borrow protocol; a protocol with no open Borrow position right now is skipped. */
const borrowKinds: PositionKind[] = [
  { protocol: 'AaveV3', knownBug: PORTFOLIO_VALUES_MISMATCH },
  { protocol: 'CompoundV3' },
  {
    protocol: 'EulerV2',
    knownBug: {
      issue: 'https://github.com/Aphelion-Co/aphelion-app/issues/1689',
      reason: 'Euler Borrow card shows "—" for Total Debt',
    },
  },
  { protocol: 'Fluid' },
  { protocol: 'Morpho', knownBug: PORTFOLIO_VALUES_MISMATCH },
  { protocol: 'Spark', knownBug: PORTFOLIO_VALUES_MISMATCH },
];

test.describe('Portfolio values match the position page', () => {
  for (const { protocol, knownBug } of borrowKinds) {
    test(
      `${protocol} Borrow card should show the collateral and debt of its position page`,
      tc('E2E-PORT-004'),
      async ({ app, request }, testInfo) => {
        knownAppBugIf(knownBug);
        testInfo.setTimeout(testInfo.timeout + 60_000);

        const [position] = await getOpenPositions(request, { product: 'Borrow', protocol });
        test.skip(!position, `No open ${protocol} Borrow position on any wallet right now`);
        testInfo.annotations.push({ type: 'position', description: JSON.stringify(position) });

        await app.portfolioPage.openPage(position.owner);
        const cardUsd = await app.portfolioPage.getBorrowAmountsUsd(position.safe);
        await app.portfolioPage.openPosition(position.safe);

        await app.positionPage.shouldShowPositionOverview();
        await app.positionPage.shouldShowBorrowAmounts(cardUsd);
      },
    );
  }
});

test.describe('Portfolio Net Value matches the position page', () => {
  for (const { protocol, knownBug } of multiplyKinds) {
    test(
      `${protocol} Multiply card should show the Net Value of its position page`,
      tc('E2E-PORT-005'),
      async ({ app, request }, testInfo) => {
        knownAppBugIf(knownBug);
        testInfo.setTimeout(testInfo.timeout + 60_000);

        const [position] = await getOpenPositions(request, { product: 'Multiply', protocol });
        test.skip(!position, `No open ${protocol} Multiply position on any wallet right now`);
        testInfo.annotations.push({ type: 'position', description: JSON.stringify(position) });

        await app.portfolioPage.openPage(position.owner);
        const cardNetValueUsd = await app.portfolioPage.getNetValueUsd(position.safe);
        await app.portfolioPage.openPosition(position.safe);

        await app.positionPage.shouldShowPositionOverview();
        await app.positionPage.shouldShowNetValue(cardNetValueUsd);
      },
    );
  }
});
