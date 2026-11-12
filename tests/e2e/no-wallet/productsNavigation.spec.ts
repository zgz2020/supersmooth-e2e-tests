import { test } from '../../../src/fixtures';
import { tc } from '../../../utils/testCase';

test.describe('Products navigation @regression', () => {
  test('it should navigate to Multiply page', tc('E2E-NAV-013'), async ({ app }) => {
    await app.borrow.open();
    await app.borrow.shouldBeOpened();

    await app.borrow.productsTopNavigation.open('Multiply');
    await app.multiply.shouldBeOpened();
  });

  test('it should navigate to Borrow page', tc('E2E-NAV-014'), async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Borrow');
    await app.borrow.shouldBeOpened();
  });

  test('it should navigate to Earn page', tc('E2E-NAV-015'), async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Earn');
    await app.earn.shouldBeOpened();
    await app.earn.productsTopNavigation.shouldHaveEarnTag('Passive Strategies');
  });

  test(
    'it should navigate to Earn - Passive Strategies page',
    tc('E2E-NAV-016'),
    async ({ app }) => {
      await app.multiply.productsTopNavigation.open('Earn - Passive Strategies');
      await app.earn.shouldBeOpened();
      await app.earn.productsTopNavigation.shouldHaveEarnTag('Passive Strategies');
    },
  );

  test(
    'it should navigate to Earn - Automated Strategies page',
    tc('E2E-NAV-017'),
    async ({ app }) => {
      await app.multiply.productsTopNavigation.open('Earn - Automated Strategies');
      await app.earn.shouldBeOpened();
      await app.earn.productsTopNavigation.shouldHaveEarnTag('Automated Strategies');
    },
  );

  test('it should navigate to Earn - Yield Loops page', tc('E2E-NAV-018'), async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Earn - Yield Loops');
    await app.earn.shouldBeOpened();
    await app.earn.productsTopNavigation.shouldHaveEarnTag('Yield Loops');
  });

  test('it should navigate to Trade page', tc('E2E-NAV-019'), async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Trade');
    await app.trade.shouldBeOpened();
  });
});
