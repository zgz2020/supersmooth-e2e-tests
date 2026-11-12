# Token Prices API

`GET /api/token-prices/current` endpoint.

## API-PRICE-001: Fetch token prices current without params

- **Priority:** P1
- **Automation:** automated

## API-PRICE-002: Fetch current token prices for requested coins

- **Priority:** P1
- **Automation:** automated

## API-PRICE-003: Fetch token prices across multiple chains

- **Priority:** P1
- **Automation:** automated

## API-PRICE-004: Handle lowercase coin address in query parameter

- **Priority:** P2
- **Automation:** automated

## API-PRICE-005: Ignore unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-PRICE-006: Return empty prices object when coins parameter is malformed

- **Priority:** P2
- **Automation:** automated

## API-PRICE-007: Reject unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.
