# Admin & Internal Endpoints (Access Control)

Internal and admin endpoints must never be usable without credentials. These cases only send
unauthenticated or invalid requests, so they are safe to run against staging.

## API-SEC-001: Cockpit endpoints reject requests without a cockpit session

- **Priority:** P1
- **Automation:** planned
- **Notes:** Covers `/api/cockpit` and `/api/cockpit/{automations,blocked-wallets,quotes,referrals,swaps,users}`.

**Steps**

1. Call every cockpit endpoint (GET, and POST/PATCH for referrals) without a session cookie
2. Repeat the writes with a foreign `Origin` header

**Expected result**

- Every request: 401/403 with no data in the body

## API-SEC-002: Scheduled jobs reject unauthenticated triggers

- **Priority:** P1
- **Automation:** planned
- **Notes:** Covers `POST /api/owner-stats/rollup`, `POST /api/invites/grant` and `PATCH /api/product-table`.

**Steps**

1. Call each endpoint without the shared secret, then with a wrong secret

**Expected result**

- 401/403 every time; no recompute/grant/update job runs

## API-SEC-003: Product table debug export is not exposed in production

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `GET /api/product-table?debug=1` without credentials against the production-like environment

**Expected result**

- 404 `Not found`, with no table data

## API-SEC-004: Indexer auth endpoint is rate-limited and validates input

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `POST /api/indexer/auth` with invalid credentials, then a burst of requests

**Expected result**

- Invalid credentials: 401; bursts: 429

## API-SEC-005: MCP OAuth rejects invalid grants and unsigned authorizations

- **Priority:** P1
- **Automation:** planned
- **Notes:** Covers `/api/mcp/oauth/{nonce,register,authorize,token,status,revoke-all}`.

**Steps**

1. `POST /api/mcp/oauth/token` with an invalid code, a wrong PKCE verifier and an unsupported grant type
2. `POST /api/mcp/oauth/authorize` without a valid wallet signature
3. `POST /api/mcp/oauth/register` with control characters in the client name

**Expected result**

- Token: RFC 6749 errors (`invalid_grant`, `unsupported_grant_type`), no token issued
- Authorize without a valid signature: 4xx
- Register: input sanitised or rejected, never stored as-is
