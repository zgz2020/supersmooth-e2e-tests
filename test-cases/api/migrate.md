# Migrate API

Migration endpoints: `GET /api/migrate/adoptable-safes` and `GET /api/migrate/earn-positions`.

## API-MIGR-001: Fetch adoptable safes regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-MIGR-002: Fetch adoptable safes for address with zero balance

- **Priority:** P1
- **Automation:** automated

## API-MIGR-003: Adoptable safes ignores unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-MIGR-004: Adoptable safes returns 400 for an invalid address parameter

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-MIGR-005: Adoptable safes rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-MIGR-006: Fetch migrate earn positions regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-MIGR-007: Fetch migrate earn positions for address with zero balance

- **Priority:** P1
- **Automation:** automated

## API-MIGR-008: Earn positions ignores unexpected query parameters

- **Priority:** P3
- **Automation:** automated

## API-MIGR-009: Earn positions returns 400 for an invalid address parameter

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-MIGR-010: Earn positions rejects unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.
