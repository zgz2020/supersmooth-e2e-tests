# Markets & Product Data API

Market and product data behind product pages, charts and the market overview.

## API-MKT-001: Product detail returns the market's real tokens

- **Priority:** P1
- **Automation:** planned
- **Notes:** `getActiveVault` relies on `collateral_token` from this endpoint to verify vaults.

**Steps**

1. `GET /api/product-detail` for known multiply and borrow markets (e.g. the canonical fallback markets in `utils/constants/urls.ts`)
2. Repeat with an unsupported `productType`, an unknown market and missing parameters

**Expected result**

- Known markets: 200, `isExactMatch: true`, schema-valid product with the expected `collateral_token` / `debt_token`
- Unsupported `productType` and missing parameters: 400; unknown market: `product: null`, never a 500

## API-MKT-002: Product rate history chart data

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `GET /api/product-rate-history` for a known market

**Expected result**

- 200 with a schema-valid, time-ordered series of finite rates

## API-MKT-003: Market stats and global market metrics

- **Priority:** P2
- **Automation:** planned
- **Notes:** Covers `/api/market-stats` and `/api/global-market-metrics`.

**Steps**

1. Call both endpoints

**Expected result**

- 200 with schema-valid payloads; TVL/volume figures are finite and non-negative

## API-MKT-004: Market overview lists (top, search, favorites, stablecoin rates)

- **Priority:** P2
- **Automation:** planned
- **Notes:** Covers `/api/market-overview/{top,search,favorites,stablecoin-borrow-rates,stablecoin-lending-rates}`.

**Steps**

1. Call each endpoint; for `search`, query a known token (e.g. `USDC`) and a nonsense string

**Expected result**

- 200 with schema-valid lists; rates are plausible percentages
- A known token search returns matches; a nonsense search returns an empty list

## API-MKT-005: Price performance

- **Priority:** P3
- **Automation:** planned

**Steps**

1. `GET /api/price-performance` for a known token

**Expected result**

- 200 with a schema-valid series of finite values

## API-MKT-006: Token catalog

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `GET /api/token-catalog`

**Expected result**

- 200; every token has address, symbol and decimals; no duplicate (chain, address) pairs

## API-MKT-007: Liquidation risk market distribution and price stats

- **Priority:** P1
- **Automation:** planned
- **Notes:** Covers `/api/liquidation-risk/market-distribution` and `/api/liquidation-risk/price-stats`.

**Steps**

1. Call both endpoints for a known collateral/debt pair
2. Repeat with an unknown pair and invalid parameters

**Expected result**

- Known pair: 200 with schema-valid, finite price points and distribution buckets
- Invalid parameters: 400, never a 500

## API-MKT-008: Earn data (protocol stats, APY history, vaults.fyi enrichment)

- **Priority:** P2
- **Automation:** planned
- **Notes:** Covers `/api/earn/protocol-stats`, `/api/earn-apy-history` and `/api/earn-vaults-fyi`.

**Steps**

1. Call each endpoint for a known Earn vault

**Expected result**

- 200 with schema-valid payloads; APYs are plausible percentages; the history is time-ordered

## API-MKT-009: Morpho vault details, allocation, peers and reallocations

- **Priority:** P2
- **Automation:** planned
- **Notes:** Covers `/api/morpho/{vault-details,vault-allocation,vault-peer-comparison,vault-reallocates}`.

**Steps**

1. Call each endpoint for a known Morpho vault (e.g. the Morpho USDC Earn fallback vault)
2. Repeat with an unknown vault address

**Expected result**

- Known vault: 200, schema-valid; allocation shares add up to ~100%
- Unknown vault: 404/empty response, never a 500
