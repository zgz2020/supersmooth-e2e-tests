# Migrate

Switching an existing Safe or wallet lending position to Supersmooth (`/migrate`).

## E2E-MIGR-001: Migrate page lists adoptable Safes

- **Priority:** P1
- **Automation:** planned
- **Notes:** Use `adoptableSafeFixture` (utils/constants/addresses.ts); see API-MIGR cases for the data requirements.

**Preconditions:** Wallet that owns the adoptable fixture Safe

**Steps**

1. Connect the wallet and open Migrate

**Expected result**

- The fixture Safe is listed with its Aave v3 position (collateral, debt, network)

## E2E-MIGR-002: Start a migration and reject the transaction

- **Priority:** P1
- **Automation:** planned

**Steps**

1. Choose the fixture Safe and start the switch to Supersmooth
2. Reject the transaction

**Expected result**

- The preview explains what will change (module, automations)
- Rejecting cancels cleanly; the Safe stays adoptable (it must never be migrated by a test)
