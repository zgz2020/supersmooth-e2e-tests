# RPC API

JSON-RPC proxy endpoint `POST /api/rpc/{chainId}`.

## API-RPC-001: Process a single JSON-RPC request on every supported chain

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-RPC-002: Process a batch JSON-RPC request on every supported chain

- **Priority:** P1
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.

## API-RPC-003: Execute eth_call to query ERC-20 contract decimals on Base

- **Priority:** P1
- **Automation:** automated

## API-RPC-004: Decode contract execution revert (0x08c379a0 Error(string)) on unauthorized transfer

- **Priority:** P1
- **Automation:** automated

## API-RPC-005: Simulate gas estimation via eth_estimateGas for contract interaction

- **Priority:** P1
- **Automation:** automated

## API-RPC-006: Return execution revert error on eth_estimateGas when transaction fails

- **Priority:** P1
- **Automation:** automated

## API-RPC-007: Filter contract logs via eth_getLogs for Transfer and Approval topics

- **Priority:** P1
- **Automation:** automated

## API-RPC-008: Fetch and validate transaction receipt structure via eth_getTransactionReceipt

- **Priority:** P1
- **Automation:** automated

## API-RPC-009: Handle concurrent multi-call batch JSON-RPC requests under load with correct ID correlation

- **Priority:** P1
- **Automation:** automated

## API-RPC-010: Inspect contract bytecode via eth_getCode

- **Priority:** P1
- **Automation:** automated

## API-RPC-011: Query account balance via eth_getBalance

- **Priority:** P1
- **Automation:** automated

## API-RPC-012: Query network version and client software info

- **Priority:** P1
- **Automation:** automated

## API-RPC-013: Preserve string/UUID ID data types per JSON-RPC 2.0 specification

- **Priority:** P1
- **Automation:** automated

## API-RPC-014: Process heterogeneous multi-method batch requests and correlate response IDs

- **Priority:** P1
- **Automation:** automated

## API-RPC-015: Return 400 bad request for empty JSON-RPC batch payload

- **Priority:** P2
- **Automation:** automated

## API-RPC-016: Return 404 not found for unsupported chain id

- **Priority:** P2
- **Automation:** automated

## API-RPC-017: Return 400 bad request for invalid non-numeric chain id

- **Priority:** P2
- **Automation:** automated

## API-RPC-018: Return 400 bad request when body is empty or invalid JSON

- **Priority:** P2
- **Automation:** automated

## API-RPC-019: Return 400 bad request for disallowed RPC method

- **Priority:** P2
- **Automation:** automated

## API-RPC-020: Reject unsupported HTTP methods with 405

- **Priority:** P3
- **Automation:** automated
- **Notes:** Data-driven: one automated test covers several input variants.
