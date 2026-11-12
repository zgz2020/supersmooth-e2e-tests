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
- **Automation:** planned
- **Notes:** Returns `500 Failed to sign fee entitlement` on local `app:fork` without its signing key (sov-e2e-tests#73).

**Steps**

1. `POST /api/fee-entitlement` with a valid request for a known market and wallet
2. Repeat with an invalid body and a foreign `Origin`

**Expected result**

- Valid request: 2xx with a signed entitlement
- Invalid body / foreign origin: 4xx, no entitlement issued

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
