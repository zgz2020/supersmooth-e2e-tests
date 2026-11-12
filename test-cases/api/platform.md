# Platform API

Health, telemetry, consent, support and indexer status endpoints.

## API-PLAT-001: Health and deep health checks

- **Priority:** P2
- **Automation:** planned
- **Notes:** Covers `/api/health` and `/api/health/deep`. Useful as a pre-flight check before suites run.

**Steps**

1. `GET /api/health` and `GET /api/health/deep`

**Expected result**

- 200 with a healthy status; the deep check reports each dependency's state

## API-PLAT-002: Indexer freshness and status

- **Priority:** P2
- **Automation:** planned
- **Notes:** `/api/indexer/freshness` is public; `/api/indexer/status` is authenticated.

**Steps**

1. `GET /api/indexer/freshness`
2. `GET /api/indexer/status` without credentials

**Expected result**

- Freshness: 200 with a recent indexed block/time (lag within an agreed threshold)
- Status without credentials: 401/403

## API-PLAT-003: Client error reporting is bounded

- **Priority:** P3
- **Automation:** planned

**Steps**

1. `POST /api/client-error` with a valid error payload
2. Send an oversized payload and a burst of requests

**Expected result**

- Valid payload accepted (2xx); oversized payloads and bursts are rejected (413/429), never a 500

## API-PLAT-004: Cookie consent

- **Priority:** P3
- **Automation:** planned

**Steps**

1. `POST /api/consent` accepting and declining the referral cookie

**Expected result**

- 2xx; the response sets or clears the referral cookie accordingly

## API-PLAT-005: Support form is validated and rate-limited

- **Priority:** P2
- **Automation:** planned
- **Notes:** Avoid real sends: use invalid payloads, or a test inbox agreed with the team.

**Steps**

1. `POST /api/support` with missing fields, an invalid email and an oversized message
2. Send a burst of requests

**Expected result**

- Invalid input: 400; bursts: 429; no email is sent for rejected requests

## API-PLAT-006: My invites requires a valid wallet signature

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `POST /api/invites/mine` with a valid signature for the test wallet
2. Repeat with an invalid signature

**Expected result**

- Valid: 200 with the wallet's invites; invalid signature: 4xx
