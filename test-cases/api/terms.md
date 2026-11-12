# Terms of Service API

Terms of Service endpoints: `accept`, `nonce` and `status` under `/api/terms/`.

## API-TERMS-001: Accept endpoint returns 401 for invalid, incomplete or unsigned payloads

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TERMS-002: Accept endpoint rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TERMS-003: Fetch terms nonce regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-TERMS-004: Nonce endpoint ignores unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-TERMS-005: Nonce endpoint returns 400 for an invalid address parameter

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TERMS-006: Nonce endpoint rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TERMS-007: Fetch terms status regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-TERMS-008: Return the correct signed status for signed and unsigned addresses

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TERMS-009: Status endpoint ignores unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-TERMS-010: Status endpoint returns 400 for an invalid address parameter

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-TERMS-011: Status endpoint rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.
