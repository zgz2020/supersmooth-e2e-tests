import { randomBytes } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  cbBtcBaseAddress,
  usdcBaseAddress,
  wethArbitrumAddress,
  wethBaseAddress,
  wethMainnetAddress,
  wethRobinhoodAddress,
} from '../../utils/constants/addresses';
import {
  effectiveSwapFeeBps,
  type FeeTier,
  POSITION_SWAP_FEE_SCHEDULE,
  REFINANCE_SWAP_FEE_SCHEDULE,
  type SwapFeeSchedule,
} from '../../utils/constants/feeTiers';
import { feeEntitlementSchema } from '../../utils/schema/api/feeEntitlementSchema';
import { validateSchema } from '../../utils/schema/validator';
import type { Address } from '../../utils/types/api/common';
import type {
  FeeEntitlementRequest,
  FeeEntitlementResponse,
} from '../../utils/types/api/feeEntitlement';
import type { TokenPricesCurrentResponse } from '../../utils/types/api/tokenPricesCurrent';
import '../../utils/assertions/matchers';
import { tc } from '../../utils/testCase';

const ENDPOINT = '/api/fee-entitlement';

type SwapToken = { symbol: string; address: Address; decimals: number };

type FeeChain = {
  name: string;
  chainId: number;
  /** DefiLlama chain slug, the prefix of the price key (`<slug>:<token>`) */
  priceSlug: string;
  /** WETH on this chain: the token the test swaps sell by default */
  weth: SwapToken;
};

const weth = (address: Address): SwapToken => ({ symbol: 'WETH', address, decimals: 18 });

/** Chains with a FeeManager deployed (aphelion-app `deployment-registry.ts`). */
const FEE_CHAINS: readonly FeeChain[] = [
  { name: 'Ethereum', chainId: 1, priceSlug: 'ethereum', weth: weth(wethMainnetAddress) },
  { name: 'Base', chainId: 8453, priceSlug: 'base', weth: weth(wethBaseAddress) },
  { name: 'Arbitrum', chainId: 42161, priceSlug: 'arbitrum', weth: weth(wethArbitrumAddress) },
  { name: 'Robinhood', chainId: 4663, priceSlug: 'robinhood', weth: weth(wethRobinhoodAddress) },
];
// Tier and request-validation logic does not depend on the chain: those cases run on Base only
const BASE = FEE_CHAINS[1];

/**
 * Base tokens with fewer decimals than WETH. The server reads the decimals on-chain to value the
 * amount: getting them wrong would misprice the swap by orders of magnitude.
 */
const BASE_NON_18_DECIMAL_TOKENS: readonly SwapToken[] = [
  { symbol: 'USDC', address: usdcBaseAddress, decimals: 6 },
  { symbol: 'cbBTC', address: cbBtcBaseAddress, decimals: 8 },
];

/**
 * A fresh Safe address for each test. Any address works: a permit is only redeemable on-chain by
 * the Safe it names (ADR-0041). The endpoint rate-limits 30 requests/min per IP + safe, so a
 * shared address would make the whole spec (and every test added to it) share one budget.
 */
const randomSafe = (): Address => `0x${randomBytes(20).toString('hex')}`;
// Test notionals sit this far from each tier boundary, so drift between the price read here and
// the one the server reads (both DefiLlama) cannot move an amount across the boundary
const BOUNDARY_MARGIN = 0.02;
// Well inside the first tier
const SMALL_NOTIONAL_USD = 1_000;

const swapRequest = ({
  safe,
  chain = BASE,
  profile = POSITION_SWAP_FEE_SCHEDULE.profile,
  sellAmountWei,
  sellToken = chain.weth.address,
}: {
  safe: Address;
  chain?: FeeChain;
  profile?: number;
  sellAmountWei: string;
  sellToken?: Address;
}): FeeEntitlementRequest => ({
  chainId: chain.chainId,
  safe,
  scope: 'swap',
  profile,
  context: { sellToken, sellAmountWei },
});

/** Token price the server prices the notional with (`/api/token-prices/current` serves DefiLlama). */
const getPriceUsd = async (
  request: APIRequestContext,
  chain: FeeChain,
  token: SwapToken = chain.weth,
): Promise<number> => {
  const priceKey = `${chain.priceSlug}:${token.address.toLowerCase()}`;
  const response = await request.get('/api/token-prices/current', { params: { coins: priceKey } });
  await expect(response).toHaveStatusCode(200);
  const { prices }: TokenPricesCurrentResponse = await response.json();
  const price = prices[priceKey];
  expect(price, `${chain.name} ${token.symbol} price should be a positive number`).toBeGreaterThan(
    0,
  );
  return price;
};

/** Token amount in its smallest unit (string) worth `notionalUsd`, to 6 decimal places. */
const amountForUsd = (notionalUsd: number, priceUsd: number, decimals = 18): string =>
  (
    (BigInt(Math.round((notionalUsd / priceUsd) * 1e6)) * 10n ** BigInt(decimals)) /
    10n ** 6n
  ).toString();

/** Checks the signed discount is the tier's, and the fee it produces is the published tier fee. */
const shouldHaveTierFee = (
  json: FeeEntitlementResponse,
  schedule: SwapFeeSchedule,
  tier: FeeTier,
) => {
  const { baseFeeBps } = json;
  const { swapDiscountBps } = json.entitlement;
  expect(baseFeeBps, 'Undiscounted profile fee').toBe(schedule.baseFeeBps);
  expect(swapDiscountBps, 'Signed discount').toBe(tier.discountBps);
  expect(
    effectiveSwapFeeBps(baseFeeBps, swapDiscountBps),
    `Fee charged with a ${swapDiscountBps} bps discount`,
  ).toBe(tier.feeBps);
};

/** A notional well inside the first tier, then one just below and one just above each boundary. */
const tierBoundaryCases = ({ tiers }: SwapFeeSchedule) => [
  { notionalUsd: SMALL_NOTIONAL_USD, tier: tiers[0] },
  ...tiers.slice(1).flatMap((tier, i) => [
    { notionalUsd: tier.minNotionalUsd * (1 - BOUNDARY_MARGIN), tier: tiers[i] },
    { notionalUsd: tier.minNotionalUsd * (1 + BOUNDARY_MARGIN), tier },
  ]),
];

/** Requests a Base swap permit for notionals around each tier boundary of `schedule`. */
const shouldPriceByTier = async (request: APIRequestContext, schedule: SwapFeeSchedule) => {
  const wethPriceUsd = await getPriceUsd(request, BASE);
  const safe = randomSafe();

  for (const { notionalUsd, tier } of tierBoundaryCases(schedule)) {
    const usd = notionalUsd.toLocaleString('en-US');

    await test.step(`$${usd} swap → ${tier.feeBps} bps`, async () => {
      const response = await request.post(ENDPOINT, {
        data: swapRequest({
          safe,
          profile: schedule.profile,
          sellAmountWei: amountForUsd(notionalUsd, wethPriceUsd),
        }),
      });

      await expect(response).toHaveStatusCode(200);
      const json: FeeEntitlementResponse = await response.json();
      await validateSchema({ schema: feeEntitlementSchema, json });
      shouldHaveTierFee(json, schedule, tier);
    });
  }
};

test.describe('Fee Entitlement API', () => {
  // A discounted tier, so the price lookup, decimals read and FeeManager reads are exercised, not
  // just the signature: a broken price or decimals silently falls back to a 0 discount (full fee)
  const happyPathTier = POSITION_SWAP_FEE_SCHEDULE.tiers[1];
  const happyPathNotionalUsd = happyPathTier.minNotionalUsd * 2;

  for (const chain of FEE_CHAINS) {
    test(
      `should issue a signed swap fee entitlement on ${chain.name}`,
      tc('API-TRADE-003'),
      async ({ request }) => {
        const wethPriceUsd = await getPriceUsd(request, chain);
        const nowSeconds = Math.floor(Date.now() / 1000);

        const response = await request.post(ENDPOINT, {
          data: swapRequest({
            safe: randomSafe(),
            chain,
            sellAmountWei: amountForUsd(happyPathNotionalUsd, wethPriceUsd),
          }),
        });

        await expect(response).toHaveStatusCode(200);
        const headers = response.headers();
        expect(headers['content-type']).toContain('application/json');
        expect(headers['cache-control'], 'A signed permit must not be cached').toBe('no-store');

        const json: FeeEntitlementResponse = await response.json();
        await validateSchema({ schema: feeEntitlementSchema, json });

        const { entitlement } = json;
        expect(entitlement.profile).toBe(POSITION_SWAP_FEE_SCHEDULE.profile);
        expect(entitlement.spreadDiscountBps, 'A swap permit carries no spread discount').toBe(0);
        expect(entitlement.sig).toBe(json.sig);
        expect(Number(entitlement.expiry), 'expiry should be in the future').toBeGreaterThan(
          nowSeconds,
        );
        expect(
          Number(entitlement.validUntil),
          'validUntil should be in the future',
        ).toBeGreaterThan(nowSeconds);
        shouldHaveTierFee(json, POSITION_SWAP_FEE_SCHEDULE, happyPathTier);
      },
    );
  }

  for (const token of BASE_NON_18_DECIMAL_TOKENS) {
    test(
      `should price a ${token.symbol} swap (${token.decimals} decimals) by notional tier`,
      tc('API-TRADE-011'),
      async ({ request }) => {
        const priceUsd = await getPriceUsd(request, BASE, token);

        const response = await request.post(ENDPOINT, {
          data: swapRequest({
            safe: randomSafe(),
            sellToken: token.address,
            sellAmountWei: amountForUsd(happyPathNotionalUsd, priceUsd, token.decimals),
          }),
        });

        await expect(response).toHaveStatusCode(200);
        const json: FeeEntitlementResponse = await response.json();
        await validateSchema({ schema: feeEntitlementSchema, json });
        shouldHaveTierFee(json, POSITION_SWAP_FEE_SCHEDULE, happyPathTier);
      },
    );
  }

  test(
    'should accept a request from a foreign Origin (public endpoint)',
    tc('API-TRADE-010'),
    async ({ request }) => {
      // ADR-0041: issuing a permit grants nothing exploitable, so Origin is not checked
      const wethPriceUsd = await getPriceUsd(request, BASE);
      const response = await request.post(ENDPOINT, {
        data: swapRequest({
          safe: randomSafe(),
          sellAmountWei: amountForUsd(SMALL_NOTIONAL_USD, wethPriceUsd),
        }),
        headers: { origin: 'https://example.com' },
      });

      await expect(response).toHaveStatusCode(200);
      const json: FeeEntitlementResponse = await response.json();
      await validateSchema({ schema: feeEntitlementSchema, json });
    },
  );

  test(
    'should price position swap fees by notional tier at each boundary',
    tc('API-TRADE-006'),
    async ({ request }) => {
      await shouldPriceByTier(request, POSITION_SWAP_FEE_SCHEDULE);
    },
  );

  test(
    'should price refinance swap fees by notional tier at each boundary',
    tc('API-TRADE-007'),
    async ({ request }) => {
      await shouldPriceByTier(request, REFINANCE_SWAP_FEE_SCHEDULE);
    },
  );

  test(
    'should give no discount when the sell token is not supported',
    tc('API-TRADE-009'),
    async ({ request }) => {
      // Not in the app's token registry: the server cannot price it, so it signs a 0 discount
      const response = await request.post(ENDPOINT, {
        data: swapRequest({
          safe: randomSafe(),
          sellAmountWei: (10n ** 30n).toString(),
          sellToken: '0x000000000000000000000000000000000000dEaD',
        }),
      });

      await expect(response).toHaveStatusCode(200);
      const json: FeeEntitlementResponse = await response.json();
      await validateSchema({ schema: feeEntitlementSchema, json });
      expect(json.entitlement.swapDiscountBps).toBe(0);
    },
  );

  // Shared by the invalid-request cases: the endpoint rejects them before the rate-limit check
  const validBody = swapRequest({ safe: randomSafe(), sellAmountWei: '1000000000000000000' });
  const invalidRequestCases: {
    description: string;
    data: unknown;
    headers?: Record<string, string>;
    status: number;
    error: string;
  }[] = [
    {
      description: 'the body is malformed JSON',
      // A Buffer is sent as-is (a string would be JSON-encoded into a valid JSON string)
      data: Buffer.from('{"chainId":'),
      headers: { 'content-type': 'application/json' },
      status: 400,
      error: 'Malformed JSON body',
    },
    {
      description: 'the body is not a JSON object',
      data: Buffer.from('"swap"'),
      headers: { 'content-type': 'application/json' },
      status: 400,
      error: 'Request body must be a JSON object',
    },
    {
      description: 'the chain is not supported',
      data: { ...validBody, chainId: 999_999 },
      status: 400,
      error: 'chainId must be a supported chain id',
    },
    {
      description: 'the safe is not an address',
      data: { ...validBody, safe: '0x123' },
      status: 400,
      error: 'safe must be a valid address',
    },
    {
      description: 'the swap context is missing',
      data: { ...validBody, context: undefined },
      status: 400,
      error: 'swap context requires sellToken and sellAmountWei',
    },
    {
      description: 'the sell amount is negative',
      data: { ...validBody, context: { ...validBody.context, sellAmountWei: '-1' } },
      status: 400,
      error: 'context.sellAmountWei must be a non-negative bigint string',
    },
    {
      description: 'the sell amount is not a number',
      data: { ...validBody, context: { ...validBody.context, sellAmountWei: '1.5' } },
      status: 400,
      error: 'context.sellAmountWei must be a non-negative bigint string',
    },
    {
      description: 'the fee profile is not discountable',
      data: { ...validBody, profile: 4 },
      status: 400,
      error: 'profile 4 is not a discountable swap fee profile',
    },
    {
      description: 'the bearer token is invalid',
      data: validBody,
      headers: { authorization: 'Bearer invalid-token' },
      status: 401,
      error: 'Unauthorized',
    },
  ];

  for (const { description, data, headers, status, error } of invalidRequestCases) {
    test(
      `should return ${status} and no entitlement when ${description}`,
      tc('API-TRADE-008'),
      async ({ request }) => {
        const response = await request.post(ENDPOINT, { data, headers });

        await expect(response).toHaveStatusCode(status);
        expect(await response.json()).toEqual({ error });
      },
    );
  }
});
