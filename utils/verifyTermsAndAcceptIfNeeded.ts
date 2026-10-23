import { expect, type APIRequestContext } from '@playwright/test';
import type { MetaMask } from '@synthetixio/synpress/playwright';
import type { App } from '../src/app';
import type { TermsStatusResponse } from './types/api/termsStatus';
import type { Token } from './types/e2e/common';
import { openPosition } from './openPosition';
import { defaultExpectTimeout } from './constants/timeouts';

export interface VerifyTermsAndAcceptIfNeededParams {
  app: App;
  metamask: MetaMask;
  address?: string;
  request?: APIRequestContext;
  collateral?: Token;
  depositAmount?: string;
  url?: string;
}

export const DEFAULT_TERMS_WALLET_ADDRESS =
  process.env.TEST_WALLET_ADDRESS || '0xb2b4D0501F82C900c703f3d85eD1918b38E7c445';
export const DEFAULT_POSITION_URL =
  '/products/multiply/aaveV3/8453/0xA238Dd80C259a72e81d7e4664a9801593F98d1c5-0x4200000000000000000000000000000000000006-0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
export const DEFAULT_DEPOSIT_AMOUNT = '0.0005';
export const DEFAULT_COLLATERAL: Token = 'ETH';

const checkTermsStatus = async (request: APIRequestContext, address: string): Promise<boolean> => {
  const response = await request.get('/api/terms/status', {
    params: {
      address,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to check terms status for ${address}: ${response.status()} ${response.statusText()}`,
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
  address = DEFAULT_TERMS_WALLET_ADDRESS,
  request,
  collateral = DEFAULT_COLLATERAL,
  depositAmount = DEFAULT_DEPOSIT_AMOUNT,
  url = DEFAULT_POSITION_URL,
}: VerifyTermsAndAcceptIfNeededParams): Promise<void> => {
  const apiRequest = request ?? app.page.request;

  // Step 1: Check if the wallet address has already accepted the terms of service
  const hasAccepted = await checkTermsStatus(apiRequest, address);
  if (hasAccepted) {
    return;
  }

  // Step 2: Perform UI flow to accept terms when not yet approved
  // 2.1 Navigate to the position page
  await app.vaultPage.openPage(url, { collateral });

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
