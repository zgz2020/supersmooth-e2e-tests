import { test } from '../../../src/fixtures';

test.describe('Products navigation @regression', () => {
  test('it should navigate to Multiply page', async ({ app }) => {
    await app.borrow.open();
    await app.borrow.shouldBeOpened();

    await app.borrow.productsTopNavigation.open('Multiply');
    await app.multiply.shouldBeOpened();
  });

  test('it should navigate to Borrow page', async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Borrow');
    await app.borrow.shouldBeOpened();
  });

  test('it should navigate to Earn page', async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Earn');
    await app.earn.shouldBeOpened();
    await app.earn.productsTopNavigation.shouldHaveEarnTag('Passive Strategies');
  });

  test('it should navigate to Earn - Passive Strategies page', async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Earn - Passive Strategies');
    await app.earn.shouldBeOpened();
    await app.earn.productsTopNavigation.shouldHaveEarnTag('Passive Strategies');
  });

  test('it should navigate to Earn - Automated Strategies page', async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Earn - Automated Strategies');
    await app.earn.shouldBeOpened();
    await app.earn.productsTopNavigation.shouldHaveEarnTag('Automated Strategies');
  });

  test('it should navigate to Earn - Yield Loops page', async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Earn - Yield Loops');
    await app.earn.shouldBeOpened();
    await app.earn.productsTopNavigation.shouldHaveEarnTag('Yield Loops');
  });

  test('it should navigate to Trade page', async ({ app }) => {
    await app.multiply.productsTopNavigation.open('Trade');
    await app.trade.shouldBeOpened();
  });
});
