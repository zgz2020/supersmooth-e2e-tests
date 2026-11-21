# Trading & Bridging API

Swap quotes, fee entitlements and cross-chain deposits: endpoints on the money path of opening
and managing positions.

## API-TRADE-001: Swap quote for a valid pair

- **Priority:** P1
- **Automation:** planned
- **Notes:** Locally the providers need `ZEROX_API_KEY` / `ONEINCH_API_KEY` (see sov-e2e-tests#73).

**Steps**

1. `POST /api/swap-quote` for a liquid pair (e.g. USDC → WETH on Base) with a realistic amount
2. Compare `amountOut` with the token prices from `/api/token-prices/current`

**Expected result**

- 200, `success: true`; `amountOut` is within a sane band of the price-implied amount
- `minAmountOut` respects the requested slippage; `routerAddress` is a known aggregator router

## API-TRADE-002: Swap quote rejects invalid input

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `POST /api/swap-quote` with a zero amount, an unknown token, the same token in and out, and a malformed body

**Expected result**

- 4xx with an error message for each case, never a 500 or a quote

## API-TRADE-003: Fee entitlement is issued for a valid request

- **Priority:** P1
- **Automation:** automated
- **Notes:** Runs on every chain with a FeeManager (Ethereum, Base, Arbitrum, Robinhood) with a
  Tier 2 swap, so each chain's price lookup is exercised (a failed price silently means a 0
  discount). Returns `503` when the signer key is not configured (local `app:fork`,
  sov-e2e-tests#73).

## API-TRADE-004: CCTP relay accepts only valid deposit attestations

- **Priority:** P1
- **Automation:** planned
- **Notes:** Gas-sponsored completion of a CCTP deposit into HyperCore.

**Steps**

1. `GET /api/cctp/relay` for a known deposit
2. `POST /api/cctp/relay` with a malformed body, an unknown burn transaction and a replayed one

**Expected result**

- Status lookups are schema-valid
- Invalid, unknown and replayed submissions are rejected (4xx) without sponsoring gas

## API-TRADE-005: Hyperliquid coin icon proxy

- **Priority:** P3
- **Automation:** planned

**Steps**

1. `GET /api/hyperliquid/coin-icons/<known coin>` and `/api/hyperliquid/coin-icons/<path traversal attempt>`

**Expected result**

- Known coin: 200 with an image content type
- Traversal / unknown icon: 4xx, never proxies arbitrary URLs

## API-TRADE-006: Position swap fee tiers at each boundary

- **Priority:** P1
- **Automation:** automated
- **Notes:** Profile 1, published schedule 30/25/15/5 bps at $0/100k/1M/10M
  (`utils/constants/feeTiers.ts`). WETH amounts 2% below and above each boundary, priced with
  `/api/token-prices/current` (the same DefiLlama price the server uses). Checks the fee charged,
  `floor(baseFeeBps × (10000 − swapDiscountBps) / 10000)`, and that the discount is the smallest one
  reaching the tier (e.g. 1334 for 25 bps).

## API-TRADE-007: Refinance swap fee tiers at each boundary

- **Priority:** P2
- **Automation:** automated
- **Notes:** Same as API-TRADE-006 on profile 6, schedule 15/10/5/2 bps at $0/1M/10M/100M.

## API-TRADE-008: Fee entitlement rejects invalid requests

- **Priority:** P2
- **Automation:** automated
- **Notes:** Malformed or non-object body, unsupported chain, invalid safe, missing swap context,
  negative or non-integer amount, non-discountable profile → 400 with the exact error; invalid
  bearer token → 401. No entitlement in any case.

## API-TRADE-009: Unsupported sell token gets no fee discount

- **Priority:** P2
- **Automation:** automated
- **Notes:** A token outside the app's registry cannot be priced, so even a huge amount gets a 0
  discount (full fee).

## API-TRADE-010: Fee entitlement accepts requests from any Origin

- **Priority:** P3
- **Automation:** automated
- **Notes:** Public by design (aphelion-app ADR-0041): a permit is only redeemable on-chain by the
  Safe it names, so a foreign `Origin` gets 200, not a 4xx.

## API-TRADE-011: Fee tier applies to sell tokens with fewer decimals

- **Priority:** P1
- **Automation:** automated
- **Notes:** USDC (6 decimals) and cbBTC (8 decimals) on Base, with a Tier 2 swap. The server reads
  the token decimals on-chain to value `sellAmountWei`; wrong decimals would misprice the swap by
  orders of magnitude and silently charge the full fee.
