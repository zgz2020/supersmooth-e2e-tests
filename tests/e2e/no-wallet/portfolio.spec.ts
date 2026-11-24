import { test } from '../../../src/fixtures';
import { getOpenPositions, type OpenPosition } from '../../../utils/getOpenPositions';
import { tc } from '../../../utils/testCase';

/**
 * Kinds whose position page is broken by an open app bug: left out so this regression test only
 * fails on new problems (tests/e2e/no-wallet/positionPages.spec.ts tracks them).
 */
const BROKEN_POSITION_PAGES: Pick<OpenPosition, 'product' | 'protocol'>[] = [];

test.describe('Portfolio @regression', () => {
  test(
    'it should open a position page from its Portfolio card',
    tc('E2E-PORT-002'),
    async ({ app, request }, testInfo) => {
      testInfo.setTimeout(testInfo.timeout + 30_000);

      const candidates = (await getOpenPositions(request)).filter(
        (p) =>
          !BROKEN_POSITION_PAGES.some((b) => b.product === p.product && b.protocol === p.protocol),
      );
      test.skip(candidates.length === 0, 'No open position on any wallet right now');
      const position = candidates[Math.floor(Math.random() * candidates.length)];
      testInfo.annotations.push({ type: 'position', description: JSON.stringify(position) });

      await app.portfolioPage.openPage(position.owner);
      await app.portfolioPage.openPosition(position.safe);

      await app.positionPage.shouldShowPositionOverview();
    },
  );
});
