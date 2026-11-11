#!/usr/bin/env node

/**
 * run-app-fork.js
 *
 * Orchestration script to run `aphelion-app` locally against an Anvil state fork.
 * Designed for manual UI testing and extensible for automated Playwright E2E suites.
 *
 * Features:
 *  - Interactive or CLI-based chain selection (Ethereum Mainnet, Base, Arbitrum One).
 *  - Public archive RPC registry with automatic failover.
 *  - Native Foundry Anvil binary detection.
 *  - Automated pre-funding: 1,000 ETH + key ERC-20 tokens (USDC, USDT, WBTC, cbBTC, WETH).
 *  - Interactive prompt for additional custom tokens with dynamic ERC-20 metadata discovery.
 *  - Baseline state snapshotting (evm_snapshot) for instant state resets.
 *  - Interactive terminal commands: "warp <time>" (evm_increaseTime) and "reset" (evm_revert).
 *  - Injects local RPC environment variables into aphelion-app and starts `pnpm dev`.
 *  - Graceful cleanup of child processes on exit.
 */

import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import console from 'node:console';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';

// -----------------------------------------------------------------------------
// Terminal Colors & Formatting
// -----------------------------------------------------------------------------
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[fork-runner]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[fork-runner] ✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[fork-runner] ⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[fork-runner] ✖${colors.reset} ${msg}`),
  anvil: (msg) => console.log(`${colors.magenta}[anvil]${colors.reset} ${msg}`),
  app: (msg) => console.log(`${colors.blue}[app]${colors.reset} ${msg}`),
};

// -----------------------------------------------------------------------------
// Environment & Configuration Loading
// -----------------------------------------------------------------------------
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }
  return env;
}

const localDotEnv = loadEnvFile();
function getEnv(key) {
  return process.env[key] || localDotEnv[key];
}

// aphelion-app requires these (see its package.json "engines"); checked up front so a
// mismatch fails with a clear message instead of a confusing error deep in `pnpm dev-app`
const MIN_NODE_VERSION = [20, 9];
const MIN_PNPM_MAJOR = 9;

function checkToolVersions() {
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (
    nodeMajor < MIN_NODE_VERSION[0] ||
    (nodeMajor === MIN_NODE_VERSION[0] && nodeMinor < MIN_NODE_VERSION[1])
  ) {
    return `Node ${MIN_NODE_VERSION.join('.')}+ is required (found ${process.versions.node}).`;
  }
  let pnpmVersion = '';
  try {
    pnpmVersion = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return 'pnpm was not found on PATH.';
  }
  if (Number(pnpmVersion.split('.')[0]) < MIN_PNPM_MAJOR) {
    return `pnpm ${MIN_PNPM_MAJOR}+ is required (found ${pnpmVersion}).`;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Curated Public Archive RPC Registry
// -----------------------------------------------------------------------------
const RPC_REGISTRY = {
  1: {
    name: 'Ethereum Mainnet',
    currency: 'ETH',
    defaultBlock: null,
    rpcs: [
      'https://gateway.tenderly.co/public/mainnet',
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.mevblocker.io',
      'https://eth.drpc.org',
    ],
    tokens: [
      {
        symbol: 'USDC',
        decimals: 6,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: 50000,
        whale: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', // Binance hot wallet
      },
      {
        symbol: 'USDT',
        decimals: 6,
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        amount: 50000,
        whale: '0x5754284f345afc66a98fbB0a0Afe71e0F007B949', // Tether Treasury / Binance
      },
      {
        symbol: 'WBTC',
        decimals: 8,
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        amount: 5,
        whale: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // Uniswap V3 Pool
      },
      {
        symbol: 'cbBTC',
        decimals: 8,
        address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        amount: 5,
        whale: '0x3c2718E00971bE5CD37C4a1236C8Bf00a5C36Fa0', // Aerodrome / Coinbase Pool
      },
      {
        symbol: 'WETH',
        decimals: 18,
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount: 50,
        whale: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // Uniswap V3 Pool
      },
    ],
  },
  8453: {
    name: 'Base',
    currency: 'ETH',
    defaultBlock: null,
    rpcs: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://1rpc.io/base'],
    tokens: [
      {
        symbol: 'USDC',
        decimals: 6,
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: 50000,
        whale: '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A', // Coinbase hot wallet on Base
      },
      {
        symbol: 'cbBTC',
        decimals: 8,
        address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
        amount: 5,
        whale: '0x04C1C4d8EFb3e4B4b5952B9b008F8B70c53bF9a0', // Aerodrome pool
      },
      {
        symbol: 'WETH',
        decimals: 18,
        address: '0x4200000000000000000000000000000000000006',
        amount: 50,
        whale: '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A',
      },
    ],
  },
  42161: {
    name: 'Arbitrum One',
    currency: 'ETH',
    defaultBlock: null,
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://1rpc.io/arb'],
    tokens: [
      {
        symbol: 'USDC',
        decimals: 6,
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        amount: 50000,
        whale: '0xb38e8c17e38363a4054821a787461c5e9ad876f2', // Binance Arbitrum hot wallet
      },
      {
        symbol: 'USDT',
        decimals: 6,
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        amount: 50000,
        whale: '0xb38e8c17e38363a4054821a787461c5e9ad876f2',
      },
      {
        symbol: 'WBTC',
        decimals: 8,
        address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        amount: 5,
        whale: '0x47c031236e19d024b42f8ed6780e44a5a3347dd8', // GMX Vault
      },
      {
        symbol: 'WETH',
        decimals: 18,
        address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        amount: 50,
        whale: '0xb38e8c17e38363a4054821a787461c5e9ad876f2',
      },
    ],
  },
};

// -----------------------------------------------------------------------------
// Helper: CLI Argument Parser
// -----------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--app-dir=')) {
      options.appDir = arg.split('=')[1];
    } else if (arg.startsWith('--chain=')) {
      options.chain = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--fork-url=')) {
      options.forkUrl = arg.split('=')[1];
    } else if (arg.startsWith('--block=')) {
      options.block = arg.split('=')[1];
    } else if (arg.startsWith('--tokens=')) {
      options.extraTokens = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

// -----------------------------------------------------------------------------
// Helper: Interactive Questions
// -----------------------------------------------------------------------------
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// -----------------------------------------------------------------------------
// Helper: JSON-RPC over HTTP
// -----------------------------------------------------------------------------
async function jsonRpc(url, method, params = [], timeout = 20000) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || JSON.stringify(json.error)));
            } else {
              resolve(json.result);
            }
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`RPC request timed out (${timeout}ms)`));
    });
    req.write(body);
    req.end();
  });
}

// -----------------------------------------------------------------------------
// Detect Anvil Binary
// -----------------------------------------------------------------------------
function findAnvilBinary() {
  const candidates = [
    getEnv('ANVIL_PATH'),
    path.join(os.homedir(), '.foundry', 'bin', 'anvil'),
    '/usr/local/bin/anvil',
    '/opt/homebrew/bin/anvil',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Check PATH via environment
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    const full = path.join(dir, 'anvil');
    if (fs.existsSync(full)) {
      return full;
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Main Runner Flow
// -----------------------------------------------------------------------------
async function main() {
  const cliArgs = parseArgs();

  if (cliArgs.help) {
    console.log(`
${colors.bold}Usage:${colors.reset} pnpm app:fork [options]

${colors.bold}Options:${colors.reset}
  --app-dir=<path>    Path to aphelion-app frontend repository
  --chain=<id>        Chain ID to fork: 1 (Ethereum), 8453 (Base), 42161 (Arbitrum)
  --fork-url=<url>    Custom RPC endpoint for state forking
  --block=<number>    Pin fork at specific block number
  --tokens=<list>     Extra tokens to fund (format: "0xToken:Amount,0xToken2:Amount")
  --help, -h          Show this help message
    `);
    process.exit(0);
  }

  console.log(`
${colors.cyan}${colors.bold}======================================================================
               LOCAL dAPP RUNNER WITH ANVIL STATE FORK
======================================================================${colors.reset}
`);

  const rl = createReadline();
  let anvilProcess = null;
  let appProcess = null;

  // Cleanup on exit
  const cleanup = () => {
    log.info('Shutting down processes...');
    if (appProcess) {
      try {
        process.kill(-appProcess.pid, 'SIGTERM');
      } catch {
        try {
          appProcess.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
    if (anvilProcess) {
      try {
        process.kill(-anvilProcess.pid, 'SIGTERM');
      } catch {
        try {
          anvilProcess.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
  };

  process.on('SIGINT', () => {
    console.log('');
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Resolve aphelion-app Directory
    // -------------------------------------------------------------------------
    const toolError = checkToolVersions();
    if (toolError) {
      log.error(toolError);
      process.exit(1);
    }

    const testWallet = getEnv('TEST_WALLET_ADDRESS');
    if (!testWallet) {
      log.error(
        'TEST_WALLET_ADDRESS is not set. Add it to .env (see .env.example) to choose the wallet to fund.',
      );
      process.exit(1);
    }

    let appDir = cliArgs.appDir || getEnv('APHELION_APP_DIR');

    if (!appDir) {
      const defaultCandidate = path.resolve(process.cwd(), '../aphelion-app');
      const defaultHint = fs.existsSync(defaultCandidate) ? defaultCandidate : '../aphelion-app';

      console.log(`${colors.bold}1. aphelion-app Path Configuration${colors.reset}`);
      const input = await askQuestion(
        rl,
        `Enter path to aphelion-app repository [default: ${defaultHint}]: `,
      );
      appDir = input.trim() || defaultHint;
    }

    // Expand ~
    if (appDir.startsWith('~/') || appDir === '~') {
      appDir = path.join(os.homedir(), appDir.slice(1));
    }
    appDir = path.resolve(process.cwd(), appDir);

    if (!fs.existsSync(appDir) || !fs.existsSync(path.join(appDir, 'package.json'))) {
      log.error(`Invalid aphelion-app directory: ${appDir}`);
      log.error(`Could not locate package.json in specified directory.`);
      rl.close();
      process.exit(1);
    }
    log.success(`Located aphelion-app: ${colors.dim}${appDir}${colors.reset}`);

    // -------------------------------------------------------------------------
    // 2. Select Chain to Fork
    // -------------------------------------------------------------------------
    let chainId = cliArgs.chain || parseInt(getEnv('ANVIL_FORK_CHAIN') || '0', 10);

    if (!chainId || !RPC_REGISTRY[chainId]) {
      console.log(`\n${colors.bold}2. Select Network to Fork${colors.reset}`);
      console.log(`  [1] Ethereum Mainnet (Chain ID: 1) ${colors.dim}[Default]${colors.reset}`);
      console.log(`  [2] Base (Chain ID: 8453)`);
      console.log(`  [3] Arbitrum One (Chain ID: 42161)`);

      const choice = await askQuestion(rl, `Select option [1]: `);
      const choiceTrimmed = choice.trim();
      if (choiceTrimmed === '2' || choiceTrimmed === '8453') {
        chainId = 8453;
      } else if (choiceTrimmed === '3' || choiceTrimmed === '42161') {
        chainId = 42161;
      } else {
        chainId = 1;
      }
    }

    const chainConfig = RPC_REGISTRY[chainId];
    log.info(
      `Target Network: ${colors.bold}${chainConfig.name}${colors.reset} (Chain ID ${chainId})`,
    );

    // -------------------------------------------------------------------------
    // 3 & 4. Resolve Candidate RPCs & Block Height Pinning
    // -------------------------------------------------------------------------
    let blockNumber = cliArgs.block;
    if (blockNumber === undefined) {
      const blockInput = await askQuestion(
        rl,
        `\nPin block number for deterministic state? [Press Enter for latest live block]: `,
      );
      blockNumber = blockInput.trim() || null;
    }

    const candidateRpcs =
      cliArgs.forkUrl || getEnv('ANVIL_FORK_URL') || getEnv('FORK_RPC_URL')
        ? [cliArgs.forkUrl || getEnv('ANVIL_FORK_URL') || getEnv('FORK_RPC_URL')]
        : chainConfig.rpcs;

    // -------------------------------------------------------------------------
    // 5. Detect and Launch Anvil (with Multi-RPC Failover)
    // -------------------------------------------------------------------------
    const anvilBin = findAnvilBinary();
    if (!anvilBin) {
      log.error(`Foundry "anvil" binary was not found in PATH or standard directories.`);
      console.log(
        `\nTo install Foundry, run:\n  ${colors.bold}curl -L https://foundry.paradigm.xyz | bash && foundryup${colors.reset}\n`,
      );
      rl.close();
      process.exit(1);
    }
    log.success(`Using Anvil binary: ${colors.dim}${anvilBin}${colors.reset}`);

    let isHealthy = false;
    let successfulRpc = '';

    for (const rpcUrl of candidateRpcs) {
      log.info(`Attempting Anvil fork using: ${colors.dim}${rpcUrl}${colors.reset}...`);

      const anvilArgs = [
        '--fork-url',
        rpcUrl,
        '--chain-id',
        chainId.toString(),
        '--port',
        '8545',
        '--auto-impersonate',
        '--code-size-limit',
        '40000',
        '--gas-limit',
        '30000000',
        '--compute-units-per-second',
        '100',
        '--retries',
        '5',
        '--timeout',
        '30000',
        '--fork-retry-backoff',
        '1000',
      ];

      if (blockNumber) {
        anvilArgs.push('--fork-block-number', blockNumber.toString());
      }

      anvilProcess = spawn(anvilBin, anvilArgs, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      anvilProcess.stdout.on('data', (d) => {
        const text = d.toString().trim();
        if (text.includes('Listening on') || text.includes('Block Number:')) {
          log.anvil(text.split('\n')[0]);
        }
      });

      anvilProcess.stderr.on('data', (d) => {
        const text = d.toString().trim();
        if (text) {
          log.anvil(`${colors.yellow}${text.split('\n')[0]}${colors.reset}`);
        }
      });

      // Wait up to 10s for this Anvil instance to become healthy
      for (let i = 0; i < 20; i++) {
        if (anvilProcess.exitCode !== null) {
          break;
        }
        try {
          await jsonRpc('http://127.0.0.1:8545', 'eth_blockNumber', [], 1000);
          isHealthy = true;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (isHealthy) {
        successfulRpc = rpcUrl;
        break;
      } else {
        log.warn(`RPC ${rpcUrl} failed or was rate-limited. Trying next candidate...`);
        try {
          anvilProcess.kill('SIGTERM');
        } catch {
          // ignore
        }
        anvilProcess = null;
      }
    }

    if (!isHealthy || !anvilProcess) {
      log.error(`Anvil node failed to start with any candidate RPC on chain ${chainId}.`);
      cleanup();
      process.exit(1);
    }
    log.success(
      `Anvil node is healthy and listening on http://127.0.0.1:8545 (forked: ${colors.dim}${successfulRpc}${colors.reset})`,
    );

    // -------------------------------------------------------------------------
    // 6. Pre-fund Test Wallet (ETH & Default ERC-20 Tokens)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}3. Seeding Test Wallet Balances${colors.reset}`);
    log.info(`Target Wallet: ${colors.bold}${testWallet}${colors.reset}`);

    // Fund 1,000 ETH
    const ethBalanceHex = '0x3635C9ADC5DEA00000'; // 1000 ETH in hex wei
    await jsonRpc('http://127.0.0.1:8545', 'anvil_setBalance', [testWallet, ethBalanceHex]);
    log.success(`Pre-funded ${colors.bold}1,000 ETH${colors.reset}`);

    // Pre-seed counterfactual Safe addresses as empty ("0x") so Anvil's revm doesn't fail on undeployed accounts
    for (const safeAddress of [
      '0xe6Cc2735F7E97274f9ee8A194DC93f2aC3CAADC9',
      '0x70c84430c251256b3fba0316c046786e3e6be2bc',
    ]) {
      await jsonRpc('http://127.0.0.1:8545', 'anvil_setCode', [safeAddress, '0x']).catch(() => {});
    }

    // Fund Default ERC-20 Tokens (only if requested via --seed-tokens or SEED_ALL_TOKENS=true)
    const fundedList = ['1,000 ETH'];
    const shouldSeedTokens = cliArgs.seedTokens || getEnv('SEED_ALL_TOKENS') === 'true';

    if (shouldSeedTokens) {
      log.info(`Seeding default ERC-20 tokens via whale impersonation...`);
      for (const token of chainConfig.tokens) {
        try {
          // Fund whale with ETH for gas
          await jsonRpc('http://127.0.0.1:8545', 'anvil_setBalance', [
            token.whale,
            '0x8AC7230489E80000', // 10 ETH
          ]);

          await jsonRpc('http://127.0.0.1:8545', 'anvil_impersonateAccount', [token.whale]);

          // transfer(address,uint256) selector: 0xa9059cbb
          const rawAmount = (BigInt(token.amount) * 10n ** BigInt(token.decimals)).toString(16);
          const data =
            '0xa9059cbb' +
            testWallet.toLowerCase().replace('0x', '').padStart(64, '0') +
            rawAmount.padStart(64, '0');

          await jsonRpc('http://127.0.0.1:8545', 'eth_sendTransaction', [
            {
              from: token.whale,
              to: token.address,
              data,
              gas: '0x186A0', // 100,000
            },
          ]);

          await jsonRpc('http://127.0.0.1:8545', 'anvil_stopImpersonatingAccount', [token.whale]);
          log.success(
            `Pre-funded ${colors.bold}${token.amount.toLocaleString()} ${token.symbol}${colors.reset}`,
          );
          fundedList.push(`${token.amount.toLocaleString()} ${token.symbol}`);
        } catch (err) {
          log.warn(`Could not fund ${token.symbol}: ${err.message}`);
        }
      }
    } else {
      log.info(
        `${colors.dim}ERC-20 token seeding skipped (pass --seed-tokens to seed tokens via whale impersonation)${colors.reset}`,
      );
    }

    // -------------------------------------------------------------------------
    // 7. Additional Custom Tokens (from ENV or CLI)
    // -------------------------------------------------------------------------
    const extraTokenQuery = cliArgs.extraTokens || getEnv('EXTRA_FUNDING_TOKENS');

    if (extraTokenQuery && extraTokenQuery.trim()) {
      const entries = extraTokenQuery.split(',');
      for (const entry of entries) {
        const [tokenAddr, rawCustomAmount, customWhale] = entry.split(':');
        const addr = (tokenAddr || '').trim();
        if (!addr.startsWith('0x') || addr.length !== 42) continue;

        try {
          // Fetch decimals via eth_call (selector: 0x313ce567)
          const decimalsHex = await jsonRpc('http://127.0.0.1:8545', 'eth_call', [
            { to: addr, data: '0x313ce567' },
            'latest',
          ]);
          const decimals = parseInt(decimalsHex, 16) || 18;
          const targetAmount = parseInt(rawCustomAmount || '10000', 10);

          // Find whale or liquidity source: use custom whale if provided, else network default whale
          const defaultWhale =
            chainConfig.tokens[0]?.whale || '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
          const whale = (customWhale || '').trim() || defaultWhale;
          await jsonRpc('http://127.0.0.1:8545', 'anvil_setBalance', [whale, '0x8AC7230489E80000']);
          await jsonRpc('http://127.0.0.1:8545', 'anvil_impersonateAccount', [whale]);

          const rawAmount = (BigInt(targetAmount) * 10n ** BigInt(decimals)).toString(16);
          const data =
            '0xa9059cbb' +
            testWallet.toLowerCase().replace('0x', '').padStart(64, '0') +
            rawAmount.padStart(64, '0');

          await jsonRpc('http://127.0.0.1:8545', 'eth_sendTransaction', [
            { from: whale, to: addr, data, gas: '0x186A0' },
          ]);
          await jsonRpc('http://127.0.0.1:8545', 'anvil_stopImpersonatingAccount', [whale]);

          log.success(`Pre-funded custom token ${addr} (${targetAmount.toLocaleString()} units)`);
          fundedList.push(`Custom (${addr.slice(0, 6)}...${addr.slice(-4)})`);
        } catch (err) {
          log.warn(`Could not seed custom token ${addr}: ${err.message}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 8. Create Baseline State Snapshot (evm_snapshot)
    // -------------------------------------------------------------------------
    const initialSnapshotId = await jsonRpc('http://127.0.0.1:8545', 'evm_snapshot', []);
    log.info(
      `Created baseline state snapshot: ${colors.dim}Snapshot ID ${initialSnapshotId}${colors.reset}`,
    );

    // -------------------------------------------------------------------------
    // 9. Display Wallet & Network Info Banner
    // -------------------------------------------------------------------------
    console.log(`
${colors.yellow}${colors.bold}======================================================================
                  🦊 METAMASK / RABBY CONFIGURATION
======================================================================${colors.reset}
  • ${colors.bold}Network Name :${colors.reset} Anvil Fork (${chainConfig.name})
  • ${colors.bold}New RPC URL  :${colors.reset} http://127.0.0.1:8545
  • ${colors.bold}Chain ID     :${colors.reset} ${chainId}
  • ${colors.bold}Currency     :${colors.reset} ${chainConfig.currency}

  • ${colors.bold}Funded Wallet:${colors.reset} ${testWallet}
  • ${colors.bold}Seeded Funds :${colors.reset} ${fundedList.join(', ')}

${colors.cyan}${colors.bold}--- INTERACTIVE COMMANDS (Type anytime into this console) ---${colors.reset}
  • ${colors.bold}warp <duration>${colors.reset} : Advance time (e.g. "warp 1d", "warp 7d", "warp 3600")
  • ${colors.bold}reset${colors.reset}           : Revert state back to initial funded snapshot
  • ${colors.bold}exit / quit${colors.reset}     : Stop Anvil and aphelion-app cleanly
${colors.yellow}======================================================================${colors.reset}
`);

    // -------------------------------------------------------------------------
    // 10. Launch aphelion-app (Next.js)
    // -------------------------------------------------------------------------
    log.info(`Launching aphelion-app from ${colors.dim}${appDir}${colors.reset}...`);

    const localAnvilRpc = 'http://127.0.0.1:8545';
    const appEnv = {
      ...process.env,
      PORT: '3000',
      NEXT_PUBLIC_LOCAL_FORK: 'true',
      NEXT_PUBLIC_DEFAULT_CHAIN_ID: chainId.toString(),
      // Server-side RPC upstreams (the browser always goes through /api/rpc/<chainId>, which uses these)
      ETH_RPC_URL: chainId === 1 ? localAnvilRpc : process.env.ETH_RPC_URL,
      PRODUCT_TABLE_ETH_RPC_URL:
        chainId === 1 ? localAnvilRpc : process.env.PRODUCT_TABLE_ETH_RPC_URL,
      BASE_RPC_URL: chainId === 8453 ? localAnvilRpc : process.env.BASE_RPC_URL,
      PRODUCT_TABLE_BASE_RPC_URL:
        chainId === 8453 ? localAnvilRpc : process.env.PRODUCT_TABLE_BASE_RPC_URL,
      ARB_RPC_URL: chainId === 42161 ? localAnvilRpc : process.env.ARB_RPC_URL,
      PRODUCT_TABLE_ARB_RPC_URL:
        chainId === 42161 ? localAnvilRpc : process.env.PRODUCT_TABLE_ARB_RPC_URL,
      FOUNDRY_RPC_URL: localAnvilRpc,
      ANVIL_RPC_URL: localAnvilRpc,
      // Ensure local origins pass CSRF and compliance origin assertions
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      FEE_SESSION_ALLOWED_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000',
    };

    appProcess = spawn('pnpm', ['dev-app'], {
      cwd: appDir,
      env: appEnv,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    appProcess.stdout.on('data', (d) => {
      const text = d.toString().trim();
      if (text.includes('Ready in') || text.includes('http://localhost:3000')) {
        log.app(`${colors.green}${colors.bold}${text}${colors.reset}`);
      } else if (text) {
        log.app(colors.dim + text.split('\n')[0] + colors.reset);
      }
    });

    appProcess.stderr.on('data', (d) => {
      const text = d.toString().trim();
      if (text) log.app(colors.dim + text.split('\n')[0] + colors.reset);
    });

    log.success(
      `aphelion-app process initiated on ${colors.bold}http://localhost:3000${colors.reset}`,
    );

    // -------------------------------------------------------------------------
    // 11. Command Listener Loop (warp, reset, exit)
    // -------------------------------------------------------------------------
    rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) return;

      if (input === 'exit' || input === 'quit') {
        cleanup();
        process.exit(0);
      } else if (input === 'reset') {
        try {
          await jsonRpc('http://127.0.0.1:8545', 'evm_revert', [initialSnapshotId]);
          // Re-create snapshot so we can reset again
          await jsonRpc('http://127.0.0.1:8545', 'evm_snapshot', []);
          log.success(`State reverted back to initial funded snapshot!`);
        } catch (err) {
          log.error(`Failed to revert state: ${err.message}`);
        }
      } else if (input.startsWith('warp ')) {
        const timeArg = input.slice(5).trim();
        let seconds = parseInt(timeArg, 10);
        if (timeArg.endsWith('d')) {
          seconds = parseInt(timeArg.slice(0, -1), 10) * 86400;
        } else if (timeArg.endsWith('h')) {
          seconds = parseInt(timeArg.slice(0, -1), 10) * 3600;
        } else if (timeArg.endsWith('m')) {
          seconds = parseInt(timeArg.slice(0, -1), 10) * 60;
        }

        if (isNaN(seconds) || seconds <= 0) {
          log.warn(`Invalid warp duration. Examples: "warp 1d", "warp 12h", "warp 3600"`);
          return;
        }

        try {
          await jsonRpc('http://127.0.0.1:8545', 'evm_increaseTime', [seconds]);
          await jsonRpc('http://127.0.0.1:8545', 'evm_mine', []);
          log.success(
            `Clock advanced forward by ${seconds.toLocaleString()} seconds (+1 block mined)`,
          );
        } catch (err) {
          log.error(`Failed to advance time: ${err.message}`);
        }
      } else {
        log.warn(`Unknown command "${input}". Available commands: "warp <time>", "reset", "exit"`);
      }
    });
  } catch (err) {
    log.error(`Unexpected error: ${err.message}`);
    cleanup();
    process.exit(1);
  }
}

main();
