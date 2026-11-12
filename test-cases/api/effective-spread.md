# Effective Spread API

`GET /api/effective-spread` endpoint.

## API-SPRD-001: Fetch effective spread for every supported network and product

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-SPRD-002: Return 400 for an invalid chainId

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-SPRD-003: Return 400 for an invalid product

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-SPRD-004: Ignore unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-SPRD-005: Reject POST with 405

- **Priority:** P3
- **Automation:** automated
