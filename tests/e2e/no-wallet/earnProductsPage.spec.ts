import { test } from '../../../src/fixtures';

test.describe('Earn products page - Passive Strategies', () => {
  test.beforeEach(async ({ app }) => {
    await app.earn.open();
    await app.earn.shouldBeOpened();
  });

  test('should display "Most Liquidity" tab as active by default with 4 cards', async ({ app }) => {
    // 1. Verify default tab active states
    await app.earn.topCards.shouldHaveTabSelected('earn', 'Most Liquidity');
    await app.earn.topCards.shouldNotHaveOtherTabsSelected('earn', 'Most Liquidity');

    // 2. Verify 4 cards are rendered
    await app.earn.topCards.shouldHaveCount(4);
  });
});
