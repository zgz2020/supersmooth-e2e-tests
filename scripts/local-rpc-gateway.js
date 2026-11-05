#!/usr/bin/env node

/**
 * local-rpc-gateway.js
 *
 * Lightweight local proxy mirroring the Supersmooth /api/rpc/:chainId gateway.
 * Forwards validated JSON-RPC 2.0 requests to a local Anvil node (or any EVM node).
 *
 * Features:
 *  - Enforces chainId routing (1, 10, 8453, 42161 supported; 404 for unknown; 400 for invalid non-numeric).
 *  - Enforces HTTP POST only (405 for GET, PUT, DELETE, PATCH).
 *  - Validates JSON-RPC payload structure (400 for malformed body).
 *  - Method allowlisting matching production security gateway (400 for disallowed methods).
 *  - Full batch JSON-RPC request/response forwarding.
 *  - Zero external dependencies: pure Node.js HTTP/HTTPS.
 */

import http from 'node:http';
import https from 'node:https';
import console from 'node:console';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

const PORT = parseInt(process.env.PORT || '3000', 10);
const ANVIL_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';

const SUPPORTED_CHAIN_IDS = new Set(['1', '10', '8453', '42161']);

const ALLOWED_RPC_METHODS = new Set([
  'eth_blockNumber',
  'eth_chainId',
  'eth_call',
  'eth_getLogs',
  'eth_getTransactionReceipt',
  'eth_getBlockByNumber',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_getBalance',
  'eth_getCode',
  'eth_getTransactionCount',
  'eth_sendRawTransaction',
  'net_version',
  'web3_clientVersion',
]);

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(json);
}

async function forwardToAnvil(anvilUrl, payload) {
  const url = new URL(anvilUrl);
  const client = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => {
          resData += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 200, data: JSON.parse(resData) });
          } catch {
            resolve({
              statusCode: 502,
              data: { error: 'Invalid JSON response from upstream node' },
            });
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' || req.url === '/api/health') {
    sendJson(res, 200, { status: 'healthy', upstream: ANVIL_URL });
    return;
  }

  const urlMatch = req.url?.match(/^\/api\/rpc\/([^/?#]+)/);
  if (!urlMatch) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const chainIdParam = urlMatch[1];

  // Validate HTTP Method
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Method ${req.method} not allowed` }));
    return;
  }

  // Validate chainId: must be numeric
  if (!/^\d+$/.test(chainIdParam)) {
    sendJson(res, 400, { error: `Invalid chain id: ${chainIdParam}` });
    return;
  }

  // Validate chainId: must be supported
  if (!SUPPORTED_CHAIN_IDS.has(chainIdParam)) {
    sendJson(res, 404, { error: `Unsupported chain id: ${chainIdParam}` });
    return;
  }

  // Read request body
  let rawBody = '';
  req.on('data', (chunk) => {
    rawBody += chunk;
  });

  req.on('end', async () => {
    if (!rawBody.trim()) {
      sendJson(res, 400, { error: 'Malformed JSON-RPC request' });
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      sendJson(res, 400, { error: 'Malformed JSON-RPC request' });
      return;
    }

    const items = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];

    // Method allowlist validation
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item.method || typeof item.method !== 'string') {
        sendJson(res, 400, { error: 'Malformed JSON-RPC request' });
        return;
      }

      if (!ALLOWED_RPC_METHODS.has(item.method)) {
        sendJson(res, 400, { error: `Method not allowed: ${item.method}` });
        return;
      }
    }

    try {
      const { statusCode, data } = await forwardToAnvil(ANVIL_URL, parsedPayload);
      sendJson(res, statusCode, data);
    } catch (err) {
      sendJson(res, 502, {
        error: `Upstream node connection failed at ${ANVIL_URL}: ${err.message}`,
      });
    }
  });
});

if (process.argv[1] && process.argv[1].endsWith('local-rpc-gateway.js')) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[local-rpc-gateway] Running on http://0.0.0.0:${PORT} -> forwarding to ${ANVIL_URL}`,
    );
  });
}

export { server, forwardToAnvil };
