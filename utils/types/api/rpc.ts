export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed?: boolean;
}

export interface JsonRpcTransactionReceipt {
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  effectiveGasPrice?: string;
  contractAddress: string | null;
  logs: JsonRpcLog[];
  logsBloom: string;
  type: string;
  status: '0x0' | '0x1' | string;
  depositNonce?: string;
  depositReceiptVersion?: string;
}

export interface DecodedRevert {
  type: 'Error' | 'Panic' | 'Custom' | 'Unknown';
  selector?: string;
  message?: string;
  code?: number;
  reason?: string;
  raw: string;
}
