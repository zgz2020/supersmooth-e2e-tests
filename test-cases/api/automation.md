# Automation & Shield API

Automation subscriptions (stop loss, trailing stop, auto sell) and Shield protection data.

## API-AUTO-001: Automation subscriptions for a wallet

- **Priority:** P1
- **Automation:** planned

**Preconditions:** A wallet with at least one active automation on staging

**Steps**

1. `GET /api/automation/subscriptions` for that wallet
2. Repeat for a wallet without automations and with an invalid address

**Expected result**

- 200 with schema-valid subscriptions (type, trigger values, latest indexed price)
- No automations: empty list; invalid address: 400

## API-AUTO-002: Shield coverage and guarded positions

- **Priority:** P2
- **Automation:** planned
- **Notes:** Covers `/api/shield/coverage` and `/api/shield/guarded`.

**Steps**

1. Call both endpoints for a guarded and an unguarded position/wallet

**Expected result**

- 200 with schema-valid payloads; guarded positions are reported as guarded, unguarded ones are not
