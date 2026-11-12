import { test } from '../../../src/fixtures';
import { tc } from '../../../utils/testCase';

test.describe('Top navigation @regression', () => {
  test.describe('Landing page', () => {
    test.beforeEach(async ({ app }) => {
      await app.landingPage.open();
      await app.landingPage.shouldBeOpened();
    });

    test('it should open Earn page', tc('E2E-NAV-001'), async ({ app }) => {
      await app.header.goTo('Earn');
      await app.earn.shouldBeOpened();
    });

    test('it should open Borrow page', tc('E2E-NAV-002'), async ({ app }) => {
      await app.header.goTo('Borrow');
      await app.borrow.shouldBeOpened();
    });

    test(
      'it should open Multiply page - Multiply nav option',
      tc('E2E-NAV-003'),
      async ({ app }) => {
        await app.header.goTo('Multiply');
        await app.multiply.shouldBeOpened();
      },
    );

    test('it should open Multiply page - Launch app button', tc('E2E-NAV-004'), async ({ app }) => {
      await app.header.launchApp();
      await app.multiply.shouldBeOpened();
    });

    test('it should scrolldown to SECURITY section', tc('E2E-NAV-005'), async ({ app }) => {
      await app.header.goToSecuritySection();
      await app.landingPage.shouldHaveSecuritySectionInViewport();
    });
  });

  test.describe('Main app', () => {
    test.describe('Multiply page', () => {
      test('it should open Landing page from main app', tc('E2E-NAV-006'), async ({ app }) => {
        await app.header.clickOnSupersmoothLogo();
        await app.landingPage.shouldBeOpened();
      });

      test(
        'it should open "Connect wallet" modal - Portfolio menu option',
        tc('E2E-NAV-007'),
        async ({ app }) => {
          await app.header.goTo('Portfolio');
          await app.modals.connectWallet.shouldBeVisible();
        },
      );

      test('it should open Migrate page', tc('E2E-NAV-008'), async ({ app }) => {
        await app.header.goTo('Migrate');
        await app.migrate.shouldBeOpened();
      });

      test('it should open DOCS in a new tab', tc('E2E-NAV-009'), async ({ app }) => {
        await app.header.shouldOpenDocsInNewTab();
      });

      test('it should open Get Help modal', tc('E2E-NAV-010'), async ({ app }) => {
        await app.header.getHelp();
        await app.modals.getHelp.shouldBeVisible();
      });

      test(
        'it should open "Connect wallet" modal - Connect Wallet button',
        tc('E2E-NAV-011'),
        async ({ app }) => {
          await app.header.connectWallet();
          await app.modals.connectWallet.shouldBeVisible();
        },
      );
    });

    test.describe('Migrate page', () => {
      test.beforeEach(async ({ app }) => {
        await app.migrate.open();
        await app.migrate.shouldBeOpened();
      });

      test('it should open Multiply page', tc('E2E-NAV-012'), async ({ app }) => {
        await app.header.goTo('Products');
        await app.multiply.shouldBeOpened();
      });
    });
  });
});
