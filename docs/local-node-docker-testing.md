# 🐳 Local EVM Node & JSON-RPC Test Harness

> **Deterministic, Offline & Containerized Blockchain Testing for CI/CD Pipelines**

This guide documents the local Anvil test node, custom JSON-RPC gateway proxy, and containerized Docker Compose testing harness implemented in `sov-e2e-tests`.

---

## 🎯 Architecture Overview

```
                                  +------------------------------------+
                                  |         Playwright Runner          |
                                  |    (tests/api/rpc.spec.ts)         |
                                  +-----------------+------------------+
                                                    | HTTP POST
                                                    v
                                  +------------------------------------+
                                  |       Local RPC Gateway Proxy      |
                                  |   (scripts/local-rpc-gateway.js)   |
                                  |  - Enforces /api/rpc/:chainId      |
                                  |  - Method allowlisting & schemas   |
                                  |  - Port 3000                       |
                                  +-----------------+------------------+
                                                    | EVM JSON-RPC
                                                    v
                                  +------------------------------------+
                                  |         Foundry Anvil Node         |
                                  |   (ghcr.io/foundry-rs/foundry)     |
                                  |  - ChainId 8453 (Base)             |
                                  |  - Port 8545                       |
                                  +------------------------------------+
```

---

## 🚀 Key Capabilities

### 1. Smart Contract JSON-RPC Test Expansion

The test suite in [`tests/api/rpc.spec.ts`](../tests/api/rpc.spec.ts) validates:

- **ERC-20 State Reads (`eth_call`):** Queries contract `decimals()` on Base USDC, decoding 6 decimals.
- **Custom Revert Error Decoding:** Detects and parses Solidity `0x08c379a0` `Error(string)` revert signatures (`ERC20: transfer from the zero address`).
- **Solidity Panic Codes Decoding:** Validates standard EVM `0x4e487b71` `Panic(uint256)` codes:
  - `0x01`: Assert evaluated to false
  - `0x11`: Arithmetic underflow / overflow
  - `0x12`: Division or modulo by zero
- **Event Log Filtering (`eth_getLogs`):** Queries and validates Ajv schemas for contract event topics:
  - `Transfer`: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
  - `Approval`: `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`
- **Transaction Receipt Validation (`eth_getTransactionReceipt`):** Validates receipt status (`0x1`), gas consumption, and 2048-bit (`logsBloom`).
- **High-Concurrency Multi-Call Batches:** Verifies gateway response correlation under parallel batch requests.

### 2. Standalone Revert Decoder (`utils/rpc/revertDecoder.ts`)

A zero-dependency TypeScript decoder that converts raw revert bytecodes into human-readable types, error messages, and panic codes.

```typescript
import { decodeRevertReason } from './utils/rpc/revertDecoder';

const result = decodeRevertReason('0x08c379a0...');
// { type: 'Error', selector: '0x08c379a0', message: 'ERC20: transfer from the zero address' }
```

---

## 🛠️ Usage Instructions

### Running via Docker Compose (Air-Gapped / CI)

Run the full local node, proxy gateway, and Playwright container without external dependencies:

```bash
pnpm test:local-node
# or directly:
docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from e2e-runner
```

### Running Locally with Native Anvil

1. Start Anvil in one terminal:
   ```bash
   anvil --host 0.0.0.0 --port 8545 --chain-id 8453
   ```
2. Start the local RPC gateway:
   ```bash
   pnpm rpc:gateway
   ```
3. Run the Playwright test suite against the local gateway:
   ```bash
   BASE_URL=http://localhost:3000 pnpm test:api
   ```
