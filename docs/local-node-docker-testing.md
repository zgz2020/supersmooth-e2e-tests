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
- **Gas Estimation (`eth_estimateGas`):** Simulates gas usage on valid contract calls and verifies execution revert handling on unauthorized transactions.
- **Contract & Account State (`eth_getCode`, `eth_getBalance`):** Inspects deployed contract bytecode structure and queries native account balances.
- **Node & Network Metadata (`net_version`, `web3_clientVersion`):** Verifies chain IDs and upstream client node runtime versions.
- **Dynamic Revert Error Inspection:** Inspects Solidity `0x08c379a0` `Error(string)` revert signatures (`ERC20: transfer from the zero address`) using dynamic ABI offset parsing.
- **Event Log Filtering (`eth_getLogs`):** Queries and validates Ajv schemas across 10 blocks for contract event topics:
  - `Transfer`: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
  - `Approval`: `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`
- **Transaction Receipt Validation (`eth_getTransactionReceipt`):** Validates receipt status (`0x1`), gas consumption, and 2048-bit bloom filter (`logsBloom`).
- **JSON-RPC 2.0 Protocol Fidelity & Batch Robustness:**
  - Preserves string/UUID request IDs without coercion to numbers.
  - Correlates heterogeneous multi-method batch responses (`eth_blockNumber`, `eth_chainId`, `eth_gasPrice`).
  - Rejects empty batches with HTTP 400 (`Empty JSON-RPC batch`).
- **High-Concurrency Multi-Call Batches:** Verifies gateway response correlation under parallel batch requests.

### 2. Native Revert Inspection

Revert error strings (Solidity `Error(string)` with selector `0x08c379a0`) are inspected directly using native Playwright assertions and standard Node.js `Buffer`:

```typescript
const errorData = String(body.error?.data ?? '');
expect(errorData.toLowerCase()).toMatch(/^(0x)?08c379a0/);

const cleanHex = errorData.startsWith('0x') ? errorData.slice(2) : errorData;
const offsetBytes = parseInt(cleanHex.slice(8, 72), 16);
const lengthOffset = 8 + (Number.isNaN(offsetBytes) ? 32 : offsetBytes) * 2;
const length = parseInt(cleanHex.slice(lengthOffset, lengthOffset + 64), 16);
const dataOffset = lengthOffset + 64;
const revertMessage = Buffer.from(
  cleanHex.slice(dataOffset, dataOffset + length * 2),
  'hex',
).toString('utf8');
expect(revertMessage).toContain('transfer from the zero address');
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
