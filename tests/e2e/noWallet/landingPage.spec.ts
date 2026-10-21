import { test } from '../../../src/fixtures/index.ts';

test.describe('Landing page top navigation @P0', () => {
  test.beforeEach(async ({ app }) => {
    await app.landingPage.open();
    await app.landingPage.shouldBeOpened();
  });

  test('it should open Earn page', async ({ app }) => {
    await app.header.goTo('Earn');
    await app.earn.shouldBeOpened();
  });

  test('it should open Borrow page', async ({ app }) => {
    await app.header.goTo('Borrow');
    await app.borrow.shouldBeOpened();
  });

  test('it should open Multiply page - Multiply nav option', async ({ app }) => {
    await app.header.goTo('Multiply');
    await app.multiply.shouldBeOpened();
  });

  test('it should open Multiply page - Launch app button', async ({ app }) => {
    await app.header.launchApp();
    await app.multiply.shouldBeOpened();
  });

  test('it should scrolldown to SECURITY section', async ({ app }) => {
    await app.header.goToSecuritySection();
    await app.landingPage.shouldHaveSecuritySectionInViewport();
  });
});
