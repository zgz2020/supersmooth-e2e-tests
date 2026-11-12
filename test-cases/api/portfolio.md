# Portfolio API

Portfolio endpoints: `recommended-strategies`, `safes` and `summary` under `/api/portfolio/`.

## API-PORT-001: Fetch recommended strategies

- **Priority:** P1
- **Automation:** automated

## API-PORT-002: Recommended strategies rejects POST with 405

- **Priority:** P3
- **Automation:** automated

## API-PORT-003: Fetch portfolio safes regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-PORT-004: Fetch portfolio safes for address with zero balance

- **Priority:** P1
- **Automation:** automated

## API-PORT-005: Portfolio safes returns 400 for an invalid address parameter

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-PORT-006: Portfolio safes rejects POST with 405

- **Priority:** P3
- **Automation:** automated

## API-PORT-007: Fetch portfolio summary regardless of address casing

- **Priority:** P1
- **Automation:** automated

## API-PORT-008: Fetch portfolio summary for address with zero balance

- **Priority:** P1
- **Automation:** automated

## API-PORT-009: Reconcile active positions count against portfolio safes

- **Priority:** P1
- **Automation:** automated

## API-PORT-010: Portfolio summary returns 400 for an invalid address parameter

- **Priority:** P2
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-PORT-011: Portfolio summary rejects POST with 405

- **Priority:** P3
- **Automation:** automated
