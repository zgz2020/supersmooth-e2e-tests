# Compliance API

Geolocation (`GET /api/compliance/geo`) and wallet screening (`POST /api/compliance/screen`) endpoints.

## API-COMP-001: Fetch compliance geo information

- **Priority:** P1
- **Automation:** automated

## API-COMP-002: Geo endpoint ignores unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-COMP-003: Geo endpoint rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-COMP-004: Resolve sanctioned, restricted and allowed countries from cf-ipcountry header

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-COMP-005: Handle lowercase cf-ipcountry header and normalize to uppercase

- **Priority:** P2
- **Automation:** automated

## API-COMP-006: Fallback to default geolocation when cf-ipcountry header is omitted

- **Priority:** P1
- **Automation:** automated

## API-COMP-007: Screen wallet regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-COMP-008: Screen wallet successfully for perps-submit context

- **Priority:** P1
- **Automation:** automated

## API-COMP-009: Flag sanctioned wallet address

- **Priority:** P1
- **Automation:** automated

## API-COMP-010: Return 401 unauthorized when origin header is missing

- **Priority:** P1
- **Automation:** automated

## API-COMP-011: Return 401 unauthorized when origin header is untrusted

- **Priority:** P1
- **Automation:** automated

## API-COMP-012: Screen endpoint returns 400 for an invalid wallet value

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-COMP-013: Screen endpoint returns 400 for an invalid context value

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-COMP-014: Return 400 bad request for malformed JSON payload

- **Priority:** P2
- **Automation:** automated

## API-COMP-015: Screen endpoint rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.
