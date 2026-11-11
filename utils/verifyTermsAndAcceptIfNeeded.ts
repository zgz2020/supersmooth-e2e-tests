import { expect, type APIRequestContext } from '@playwright/test';
import type { MetaMask } from '@synthetixio/synpress/playwright';
import type { App } from '../src/app';
import type { TermsStatusResponse } from './types/api/termsStatus';
import type { FixturesNetwork, Token } from './types/e2e/common';
import { openPosition } from './openPosition';
import { defaultExpectTimeout } from './constants/timeouts';
import { getActiveVault } from './getActiveVault';
import { FALLBACK_MARKETS, vaultPath } from './constants/urls';
import { defaultTestWalletAddress } from './constants/addresses';

export interface VerifyTermsAndAcceptIfNeededParams {
  app: App;
  metamask: MetaMask;
  network?: FixturesNetwork;
  address?: string;
  request?: APIRequestContext;
  collateral?: Token;
  depositAmount?: string;
  url?: string;
}

export const DEFAULT_TERMS_WALLET_ADDRESS =
  process.env.TEST_WALLET_ADDRESS || defaultTestWalletAddress;
export const DEFAULT_POSITION_URL_BASE = vaultPath(
  'multiply',
  'morpho',
  8453,
  FALLBACK_MARKETS.morphoEthBase,
);
export const DEFAULT_POSITION_URL_ETHEREUM = vaultPath(
  'multiply',
  'spark',
  1,
  FALLBACK_MARKETS.sparkWethUsdsEthereum,
);
export const DEFAULT_POSITION_URL = DEFAULT_POSITION_URL_BASE;
export const DEFAULT_DEPOSIT_AMOUNT = '0.00025';
export const DEFAULT_COLLATERAL: Token = 'ETH';

const checkTermsStatus = async (request: APIRequestContext, address: string): Promise<boolean> => {
  const response = await request.get('/api/terms/status', {
    params: {
      // Lowercase avoids 400s caused by addresses with an invalid EIP-55 checksum
      address: address.toLowerCase(),
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to check terms status for ${address}: ${response.status()} ${await response.text()}`,
    );
  }

  const data: TermsStatusResponse = await response.json();
  return !data.enforced || data.signed;
};

/**
 * Checks whether the specified wallet address has accepted terms of service,
 * and executes the UI signing workflow if terms have not yet been approved.
 */
export const verifyTermsAndAcceptIfNeeded = async ({
  app,
  metamask,
  network = 'Base',
  address = DEFAULT_TERMS_WALLET_ADDRESS,
  request,
  collateral = DEFAULT_COLLATERAL,
  depositAmount = DEFAULT_DEPOSIT_AMOUNT,
  url,
}: VerifyTermsAndAcceptIfNeededParams): Promise<void> => {
  const apiRequest = request ?? app.page.request;

  // Step 1: Check if the wallet address has already accepted the terms of service
  const hasAccepted = await checkTermsStatus(apiRequest, address);
  if (hasAccepted) {
    return;
  }

  // Step 2: Perform UI flow to accept terms when not yet approved
  let targetUrl = url;
  let targetCollateral = collateral;

  if (!targetUrl || targetUrl === DEFAULT_POSITION_URL) {
    try {
      const active = await getActiveVault(apiRequest, 'multiply', {
        network,
        collateral,
      });
      targetUrl = active.url;
      targetCollateral = active.collateral;
    } catch {
      targetUrl =
        network === 'Ethereum' ? DEFAULT_POSITION_URL_ETHEREUM : DEFAULT_POSITION_URL_BASE;
    }
  }

  // 2.1 Navigate to the position page
  await app.vaultPage.openPage(targetUrl, { collateral: targetCollateral });

  // 2.2 & 2.3 Enter deposit amount and open position to trigger the terms modal
  await openPosition({
    app,
    positionType: 'Multiply',
    depositAmount,
  });

  // 2.4 Verify terms modal is visible and check the acceptance checkbox
  await app.modals.termsOfService.shouldBeVisible({ timeout: defaultExpectTimeout * 2 });
  await app.modals.termsOfService.acceptTerms();

  // 2.5 Submit terms acceptance in the dApp and confirm signature in MetaMask
  await app.modals.termsOfService.signAndAccept();
  await metamask.confirmSignature();

  // 2.6 Poll the terms status API (with 2s intervals) to verify approval
  await expect
    .poll(async () => await checkTermsStatus(apiRequest, address), {
      message: `Terms approval verification failed for address ${address}`,
      intervals: [2_000],
      timeout: 7_000,
    })
    .toBe(true);
};
