import { test } from '../../../src/fixtures';
import { knownAppBugIf, type KnownAppBug } from '../../../src/fixtures/knownAppBug';
import {
  getOpenPositions,
  type IndexerProduct,
  type IndexerProtocol,
} from '../../../utils/getOpenPositions';
import { tc } from '../../../utils/testCase';

interface PositionKind {
  product: IndexerProduct;
  protocol: IndexerProtocol;
  /** Open app bug that stops this kind of position page from opening */
  knownBug?: KnownAppBug;
}

/** Every Borrow / Multiply protocol and the Earn protocols with Supersmooth positions; a kind with no open position right now is skipped. */
const positionKinds: PositionKind[] = [
  { product: 'Borrow', protocol: 'AaveV3' },
  { product: 'Borrow', protocol: 'CompoundV3' },
  { product: 'Borrow', protocol: 'EulerV2' },
  { product: 'Borrow', protocol: 'Fluid' },
  { product: 'Borrow', protocol: 'Morpho' },
  { product: 'Borrow', protocol: 'Spark' },
  { product: 'Multiply', protocol: 'AaveV3' },
  { product: 'Multiply', protocol: 'AaveV3Lido' },
  { product: 'Multiply', protocol: 'CompoundV3' },
  { product: 'Multiply', protocol: 'EulerV2' },
  { product: 'Multiply', protocol: 'Fluid' },
  { product: 'Multiply', protocol: 'Morpho' },
  { product: 'Multiply', protocol: 'Spark' },
  { product: 'Earn', protocol: 'AaveV3' },
  { product: 'Earn', protocol: 'Fluid' },
  { product: 'Earn', protocol: 'Lido' },
  { product: 'Earn', protocol: 'Morpho' },
];

test.describe('Position pages', () => {
  for (const { product, protocol, knownBug } of positionKinds) {
    test(
      `${protocol} ${product} position page should load`,
      tc('E2E-PPAGE-001'),
      async ({ app, request }, testInfo) => {
        knownAppBugIf(knownBug);
        testInfo.setTimeout(testInfo.timeout + 30_000);

        const [position] = await getOpenPositions(request, { product, protocol });
        test.skip(!position, `No open ${protocol} ${product} position on any wallet right now`);
        testInfo.annotations.push({ type: 'position', description: JSON.stringify(position) });

        // Test data only: the app builds position URLs itself (no API returns them), so take the
        // exact link it gives users from the Portfolio card, then open it like a pasted URL
        await app.portfolioPage.openPage(position.owner);
        const url = await app.portfolioPage.getPositionUrl(position.safe);

        await app.positionPage.goto(url);
        await app.positionPage.shouldShowPositionOverview();
      },
    );
  }
});
