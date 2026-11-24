# Position Pages

Position pages of open positions held by any wallet (no wallet connected).

## E2E-PPAGE-001: Position page of each kind of open position loads

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven, one test per Borrow / Multiply protocol and per Earn protocol with
  Supersmooth positions (Aave v3, Fluid, Lido, Morpho). Each test takes the largest open
  position of that kind on any wallet from the indexer's public GraphQL API
  ([`utils/getOpenPositions.ts`](../../utils/getOpenPositions.ts)) and opens its page by URL, as
  when a user pastes a link. No API returns position URLs (the app builds them), so the test
  reads the exact link from the owner's Portfolio card without clicking it. Fails as soon as an
  error screen shows instead of waiting for the overview. A kind with no open position at the
  time is skipped.

**Steps**

1. Open the position page URL of an open position

**Expected result**

- The page shows its Position Overview, with no error screen (such as `Invalid market
identifier`)
