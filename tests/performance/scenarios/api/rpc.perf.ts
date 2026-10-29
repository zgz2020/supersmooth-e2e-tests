import { check, sleep } from 'k6';
import http from 'k6/http';
import type { Options } from 'k6/options';
import { getBaseUrl, performanceEnv } from '../../config/environments.ts';
import { getProfileOptions } from '../../config/profiles.ts';

export const options: Options = getProfileOptions();
const BASE_URL = getBaseUrl();

// Base chainId (8453) matches tests/api/rpc.spec.ts
const DEFAULT_CHAIN_ID = 8453;

export function runRpcScenario(chainId: number = DEFAULT_CHAIN_ID): void {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_blockNumber',
    params: [],
  });

  const res = http.post(`${BASE_URL}/api/rpc/${chainId}`, payload, {
    headers: {
      ...performanceEnv.defaultHeaders,
      'Content-Type': 'application/json',
    },
    tags: { name: `POST /api/rpc/${chainId} (eth_blockNumber)`, type: 'rpc' },
  });

  check(res, {
    'rpc responded 200': (r) => r.status === 200,
    'rpc returned jsonrpc response': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body && (body.jsonrpc === '2.0' || 'result' in body || 'error' in body);
      } catch {
        return false;
      }
    },
  });

  sleep(0.2);
}

export default function (): void {
  runRpcScenario();
}
