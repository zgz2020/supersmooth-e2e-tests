# Product Table Top Cards API

`GET /api/product-table/top-cards` endpoint.

## API-TOPC-001: Fetch top cards for every valid productType / filterId combination

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TOPC-002: Ignore unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-TOPC-003: Return 400 for missing, invalid or mismatched productType / filterId

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TOPC-004: Reject unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.
