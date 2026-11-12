import { test } from '../../../src/fixtures';
import { getActiveVault } from '../../../utils/getActiveVault';
import type { TopCardsProductType } from '../../../utils/types/api/productTableTopCards';
import { tc } from '../../../utils/testCase';

interface VaultTestCase {
  positionType: string;
  productType: TopCardsProductType;
  filterId?: string;
  protocols?: string;
}

const testCases: VaultTestCase[] = [
  {
    positionType: 'Multiply',
    productType: 'multiply',
    filterId: 'most-liquidity',
  },
  {
    positionType: 'Borrow',
    productType: 'borrow',
    filterId: 'most-liquidity',
  },
  {
    positionType: 'Earn - Passive Strategy',
    productType: 'earn',
    filterId: 'most-liquidity',
  },
  {
    positionType: 'Earn - Automated Strategy',
    productType: 'earn',
    filterId: 'highest-current-apy',
    protocols: 'gauntlet,morpho',
  },
  {
    positionType: 'Earn - Yield Loops',
    productType: 'yieldLoop',
    filterId: 'most-liquidity',
    protocols: 'spark,fluid',
  },
];

test.describe('Vault pages', () => {
  for (const { positionType, productType, filterId, protocols } of testCases) {
    test(
      `it should request to connect wallet when trying to open a ${positionType} position`,
      tc('E2E-VAULT-001'),
      async ({ app, request }) => {
        const { url, collateral } = await getActiveVault(request, productType, {
          filterId,
          protocols,
        });

        await app.vaultPage.openPage(url, { collateral });

        await app.vaultPage.rightSidePanel.configurePosition.connectWallet();
        await app.modals.connectWallet.shouldBeVisible();
      },
    );
  }
});
