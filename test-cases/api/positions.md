# Positions API

Per-position data shown on position pages: history, PnL, performance, fees, borrow cost and
Borrow/Earn links (`/api/position-*`, `/api/accrued-borrow-cost`, `/api/borrow-*`, `/api/yield-history`).

## API-POS-001: Position history returns the events of an existing position

- **Priority:** P1
- **Automation:** planned

**Preconditions:** A wallet with an open position on staging (e.g. the default test wallet's Base Safe)

**Steps**

1. `GET /api/position-history` with that position's identifiers
2. Repeat with an unknown position

**Expected result**

- 200 with a schema-valid, chronologically ordered event list for the open position
- An unknown position returns an empty list or 404, never a 500

## API-POS-002: Position PnL is consistent with position value

- **Priority:** P1
- **Automation:** planned

**Steps**

1. `GET /api/position-pnl` for an open position
2. Compare with the position value from `/api/portfolio/summary`

**Expected result**

- 200 with a schema-valid PnL payload
- PnL values are finite numbers and consistent in sign/magnitude with the portfolio value

## API-POS-003: Multiply performance & payoff returns a cost basis

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `GET /api/position-performance` for an open Multiply position

**Expected result**

- 200 with a schema-valid cost-basis payload; amounts are non-negative

## API-POS-004: Yield-loop fees since open

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `GET /api/position-fees` for an open yield-loop position
2. Repeat for a position without fees

**Expected result**

- 200; swap fees and Supersmooth spread are non-negative and add up to the reported total
- A position without fees returns zeros, not an error

## API-POS-005: Position opened-at lookup

- **Priority:** P3
- **Automation:** planned

**Steps**

1. `GET /api/position-opened-at` for an open position and for an unknown one

**Expected result**

- Open position: 200 with a timestamp in the past
- Unknown position: empty/404 response, never a 500

## API-POS-006: Borrow costs (accrued, breakdown, net rate)

- **Priority:** P1
- **Automation:** planned
- **Notes:** Covers `/api/accrued-borrow-cost`, `/api/borrow-cost-breakdown` and `/api/borrow-net-cost`.

**Steps**

1. Call each endpoint for an open Borrow position
2. Call each with missing / invalid parameters

**Expected result**

- 200 with schema-valid, finite, non-negative costs; the net rate is a plausible percentage
- Invalid input returns 400, never a 500

## API-POS-007: Yield-loop history

- **Priority:** P2
- **Automation:** planned

**Steps**

1. `GET /api/yield-history` for an open yield-loop position

**Expected result**

- 200 with a schema-valid, time-ordered series

## API-POS-008: Create a Borrow → Earn position link only with a valid signature

- **Priority:** P1
- **Automation:** planned
- **Notes:** Security: "nothing the client asserts is trusted" (signed typed data, nonce, origin).

**Steps**

1. `POST /api/position-links` with a correctly signed payload
2. Replay the same payload
3. Send a payload with a wrong signature, another wallet's Safe, or a foreign `Origin`

**Expected result**

- Valid request creates the link (2xx) and `GET /api/position-links` returns it
- Replay, bad signature, foreign Safe and foreign origin are rejected (4xx) and create nothing

## API-POS-009: Unlink a Borrow/Earn pair only with a valid signature

- **Priority:** P1
- **Automation:** planned

**Steps**

1. `POST /api/position-links/unlink` with a valid signed request for an existing link
2. Repeat with an invalid signature or nonce

**Expected result**

- Valid request soft-unlinks the pair (no longer returned by `GET /api/position-links`)
- Invalid requests are rejected (4xx) and leave the link in place
