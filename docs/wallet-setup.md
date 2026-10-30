# 🦊 Web3 Wallet Automation & Synpress Setup Guide

This guide details the setup, configuration, and execution of Web3 wallet automation tests using **[Synpress](https://github.com/Synthetixio/synpress)** v4 and **MetaMask** in this repository.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites & Environment Configuration](#prerequisites--environment-configuration)
- [Building the Wallet Cache](#building-the-wallet-cache)
- [Running With-Wallet Tests](#running-with-wallet-tests)
- [Wallet & Network Utilities](#wallet--network-utilities)
- [CI Execution & Framebuffer (xvfb)](#ci-execution--framebuffer-xvfb)
- [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## 🔍 Overview

Web3 tests require interacting with browser extensions (MetaMask), connecting accounts to dApps, approving network additions/switches, signing Terms of Service, and approving blockchain transactions.

To avoid initializing and importing private keys on every single test execution, Synpress generates an isolated browser cache containing a pre-configured MetaMask profile under `.cache-synpress/`.

---

## ⚙️ Prerequisites & Environment Configuration

Define your test wallet credentials in `.env`:

```ini
# Private key used to import the test wallet into MetaMask
TEST_WALLET_PK='0x...your_private_key...'

# Public address of the test wallet (used for Terms of Service status checks)
TEST_WALLET_ADDRESS='0x...your_public_address...'
```

> [!CAUTION]
> **Never commit real private keys or funded production wallets.** Use dedicated testnet/staging wallets only.

---

## 🏗️ Building the Wallet Cache

Before running tests with wallet interactions, build the local Synpress cache:

```bash
pnpm synpress-build-cache:base
```

This command runs `utils/synpress/wallet-setup/base.setup.ts`, launches MetaMask in Chromium, imports the private key from `TEST_WALLET_PK`, and saves the state to `.cache-synpress`.

---

## 🧪 Running With-Wallet Tests

Once the cache is built, run the with-wallet test suite:

```bash
# Run all with-wallet tests:
pnpm test:with-wallet

# Run regression tests only:
pnpm test:with-wallet-regression
```

---

## 🌐 Wallet & Network Utilities

The `utils/` directory provides reusable helpers for managing wallet interactions during test execution:

### 1. `connectWallet`

Located in [`utils/connectWallet.ts`](../utils/connectWallet.ts):

```typescript
await connectWallet({ app, metamask, network: 'Base' });
```

- Opens the application's Connect Wallet modal.
- Selects MetaMask.
- Approves the connection request inside the MetaMask extension.
- Optionally switches to the target network (defaults to `'Base'`).

### 2. `switchNetwork`

Located in [`utils/switchNetwork.ts`](../utils/switchNetwork.ts):

```typescript
await switchNetwork({ app, metamask, network: 'Arbitrum One' });
```

- Opens the network selector modal in the dApp header.
- Selects the target chain (`'Arbitrum One' | 'Base' | 'Ethereum' | 'HyperEVM' | 'OP Mainnet'`).
- Automatically approves the network addition and network switch prompts in MetaMask.

### 3. `verifyTermsAndAcceptIfNeeded`

Located in [`utils/verifyTermsAndAcceptIfNeeded.ts`](../utils/verifyTermsAndAcceptIfNeeded.ts):

```typescript
await verifyTermsAndAcceptIfNeeded({ app, metamask, address });
```

- Checks whether the test wallet has signed the Terms of Service via `/api/terms/status`.
- If unsigned, triggers the Terms of Service signature flow, signs in MetaMask, and verifies completion.
- Integrated automatically into the custom `app` test fixture (`src/fixtures/base.ts`).

### 4. `openPosition`

Located in [`utils/openPosition.ts`](../utils/openPosition.ts):

- Helper to select collateral, configure leverage/deposit amounts, approve token allowances, and execute position openings.

### 5. `getActiveVault`

Located in [`utils/getActiveVault.ts`](../utils/getActiveVault.ts):

```typescript
const { url, collateral } = await getActiveVault(app.page.request, 'multiply', {
  network: 'Base',
  collateral: 'ETH',
});
```

- Dynamically resolves live, non-deprecated pool routes using `/api/product-table/top-cards` with server-rendered catalog HTML fallback.
- Ensures with-wallet tests navigate only to active pools matching the test wallet's funded token balances (e.g., `ETH`, `wstETH`, `cbETH`, `USDC` on Base).
- See the dedicated **[Dynamic Vault Selection Guide](dynamic-vault-selection.md)** for full reference.

---

## 🤖 CI Execution & Framebuffer (xvfb)

Because browser extensions (like MetaMask) require a display server to render and interact with extension popups, headless Linux environments in CI (such as GitHub Actions) must execute tests inside a virtual framebuffer via `xvfb-run`:

```bash
# In CI:
pnpm ci:synpress-build-cache:base
pnpm ci:with-wallet
```

> [!NOTE]
> In CI workflows, with-wallet tests are intentionally limited to `WORKERS='1'` to prevent MetaMask extension race conditions.

---

## 🛠️ Troubleshooting & Best Practices

1. **Stale Cache:** If MetaMask tests fail unexpectedly or extension windows fail to open, delete the local cache and rebuild:
   ```bash
   rm -rf .cache-synpress
   pnpm synpress-build-cache:base
   ```
2. **Missing Wallet Credentials:** Ensure `TEST_WALLET_PK` is defined in `.env` or passed via GitHub Actions Secrets.
3. **Geo-Blocking in CI:** Certain surfaces (such as Perpetual Contracts) are restricted by geo-compliance in US-hosted CI runners. See the [CI & GitHub Runs Guide](ci-github-runs.md) for details on geo-bypass headers and regional routing.
