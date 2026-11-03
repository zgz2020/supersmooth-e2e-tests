import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const { AbortController, setTimeout, clearTimeout, URLSearchParams } = globalThis;

/**
 * Universal HTTP client with automatic fallback for local runtimes (< Node 18)
 */
export async function universalFetch(urlStr, options = {}) {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(urlStr, options);
  }

  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(
        parsedUrl,
        {
          method: options.method || 'GET',
          headers: {
            'User-Agent': 'Sov-E2E-Route-Crawler/1.0',
            Accept: 'text/html,application/xhtml+xml,application/json',
            ...(options.headers || {}),
          },
          signal: options.signal,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              text: async () => data,
              json: async () => JSON.parse(data),
            });
          });
        },
      );

      req.on('error', reject);
      if (options.timeoutMs) {
        req.setTimeout(options.timeoutMs, () => {
          req.destroy(new Error(`Timeout after ${options.timeoutMs}ms`));
        });
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 🕷️ Autonomous Route Crawler & Route Auditor (pnpm agent:crawl)
 *
 * Resolves Aphelion-Co/aphelion-app#1649:
 * Autonomously crawls dynamic DeFi liquidity pools and position URLs across
 * Ethereum (1), Base (8453), Robinhood (4663), and Arbitrum (42161).
 *
 * Verifies:
 *   1. HTTP 200 OK
 *   2. Absence of "Page not found" 404 boundaries and React error boundaries
 *   3. Zero unhandled server-side rendering crashes or missing assets
 *
 * Generates:
 *   - ai-reports/route-health-audit.md
 *   - ai-reports/latest-route-audit.json
 *   - GitHub Actions Step Summary
 */

export const CHAIN_NAMES = {
  1: 'Ethereum',
  8453: 'Base',
  4663: 'Robinhood',
  42161: 'Arbitrum',
};

export const DEFAULT_DISCOVERY_QUERIES = [
  { productType: 'multiply', filterId: 'lowest-cost' },
  { productType: 'multiply', filterId: 'highest-multiple' },
  { productType: 'multiply', filterId: 'most-liquidity' },
  { productType: 'borrow', filterId: 'highest-ltv' },
  { productType: 'borrow', filterId: 'lowest-borrow-rate' },
  { productType: 'borrow', filterId: 'most-liquidity' },
  {
    productType: 'earn',
    filterId: 'highest-current-apy',
    protocols:
      'aaveV3,coinbase,compoundV3,ethena,etherfi,euler,fluid,lido,maple,rocketPool,sky,spark',
  },
  {
    productType: 'earn',
    filterId: 'highest-current-apy',
    protocols: 'gauntlet,morpho',
  },
  { productType: 'earn', filterId: 'most-liquidity' },
  { productType: 'yieldLoop', filterId: 'most-liquidity' },
  { productType: 'yieldLoop', filterId: 'highest-apy' },
  { productType: 'yieldLoop', filterId: 'featured' },
];

export const CATALOG_TARGETS = [
  { path: '/products/multiply', productType: 'multiply', name: 'Multiply' },
  { path: '/products/borrow', productType: 'borrow', name: 'Borrow' },
  { path: '/products/earn', productType: 'earn', name: 'Earn (Passive Strategies)' },
  {
    path: '/products/earn?strategy=yield-loops',
    productType: 'yieldLoop',
    name: 'Earn (Yield Loops)',
  },
  {
    path: '/products/earn?strategy=automated-strategies',
    productType: 'earn',
    name: 'Earn (Automated Strategies)',
  },
];

export const CATALOG_PAGES = ['earn', 'borrow', 'multiply', 'yield-loop'];

/**
 * Parses route components from a dynamic position URL
 * Handles standard addresses as well as compound hyphenated market IDs (e.g. Spark/Aave).
 * E.g. /products/yield-loop/morpho/8453/0x3a4048c64ba1b375330d376b1ce40e4047d03b47ab4d48af484edec9fec801ba
 * E.g. /products/multiply/spark/1/0xC13e21...-0xcbB7...-0xdC03...
 */
export function parseRouteDetails(url) {
  if (!url || typeof url !== 'string') return null;

  const normalized = url.startsWith('/') ? url : `/${url}`;
  const match = normalized.match(
    /^\/products\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/(\d+)\/([a-zA-Z0-9xX_-]+)/,
  );

  if (!match) return null;

  const [, productType, protocol, chainId, poolId] = match;
  return {
    url: normalized,
    productType,
    protocol,
    chainId,
    networkName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
    poolId,
  };
}

/**
 * Extracts position URLs from server-rendered catalog HTML (both top cards and tables)
 */
export function extractRoutesFromHtml(html, defaultProductType = 'earn') {
  if (!html || typeof html !== 'string') return [];

  const foundRoutes = new Map();
  const linkRegex = /href="(\/products\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/\d+\/[a-zA-Z0-9xX_-]+)"/g;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const details = parseRouteDetails(rawUrl);
    if (details && !foundRoutes.has(details.url)) {
      foundRoutes.set(details.url, {
        ...details,
        source: 'catalog-table',
        title: `${details.protocol} ${details.productType || defaultProductType}`,
      });
    }
  }

  return Array.from(foundRoutes.values());
}

/**
 * Extracts position routes from Top Cards API JSON response
 */
export function extractRoutesFromTopCards(jsonData, defaultProductType = 'earn') {
  if (!jsonData || !Array.isArray(jsonData.cards)) return [];

  const foundRoutes = new Map();
  for (const card of jsonData.cards) {
    if (!card.url) continue;
    const details = parseRouteDetails(card.url);
    if (!details) continue;

    if (!foundRoutes.has(details.url)) {
      foundRoutes.set(details.url, {
        ...details,
        title: card.title || `${details.protocol} ${details.productType || defaultProductType}`,
        tokens: Array.isArray(card.tokens) ? card.tokens : [],
        source: 'top-cards-api',
      });
    }
  }

  return Array.from(foundRoutes.values());
}

/**
 * Evaluates HTML content for 404 boundaries or error screens
 */
export function checkHtmlHealth(html, statusCode = 200) {
  if (statusCode === 404) {
    return {
      healthy: false,
      has404Fallback: true,
      hasErrorBoundary: false,
      reason: 'HTTP 404 Not Found',
    };
  }

  if (statusCode >= 400) {
    return {
      healthy: false,
      has404Fallback: false,
      hasErrorBoundary: true,
      reason: `HTTP ${statusCode} Server Error`,
    };
  }

  if (!html || typeof html !== 'string') {
    return {
      healthy: false,
      has404Fallback: false,
      hasErrorBoundary: true,
      reason: 'Empty response payload',
    };
  }

  const lower = html.toLowerCase();

  // Detect 404 Fallback patterns
  const is404 =
    lower.includes('page not found') ||
    lower.includes('this page could not be found') ||
    lower.includes('<h1 class="next-error-h1">404</h1>') ||
    (lower.includes('404') && lower.includes('not found'));

  if (is404) {
    return {
      healthy: false,
      has404Fallback: true,
      hasErrorBoundary: false,
      reason: 'DOM contains 404 "Page not found" fallback',
    };
  }

  // Detect unhandled React/Next.js Error Boundaries
  const isErrorBoundary =
    lower.includes('application error: a client-side exception') ||
    lower.includes('something went wrong') ||
    lower.includes('internal server error');

  if (isErrorBoundary) {
    return {
      healthy: false,
      has404Fallback: false,
      hasErrorBoundary: true,
      reason: 'DOM contains unhandled React error boundary',
    };
  }

  return {
    healthy: true,
    has404Fallback: false,
    hasErrorBoundary: false,
    reason: 'OK',
  };
}

/**
 * Concurrently audits a list of routes with batch limiting
 */
export async function auditAllRoutes(routes, options = {}) {
  const fetcher = options.fetcher || universalFetch;
  const baseUrl = (options.baseUrl || 'https://staging.supersmooth.fi').replace(/\/$/, '');
  const concurrency = options.concurrency || 5;
  const timeoutMs = options.timeoutMs || 10000;

  const results = [];
  const queue = [...routes];

  async function worker() {
    while (queue.length > 0) {
      const route = queue.shift();
      if (!route) break;

      const fullUrl = `${baseUrl}${route.url}`;
      const start = Date.now();
      let status = 'PASS';
      let statusCode = null;
      let errorReason = '';
      let has404Fallback = false;
      let hasErrorBoundary = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetcher(fullUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Sov-E2E-Route-Crawler/1.0',
            Accept: 'text/html,application/xhtml+xml,application/json',
          },
        });

        clearTimeout(timeoutId);
        statusCode = response.status;
        const text = await response.text();
        const health = checkHtmlHealth(text, statusCode);

        if (!health.healthy) {
          status = 'FAIL';
          has404Fallback = health.has404Fallback;
          hasErrorBoundary = health.hasErrorBoundary;
          errorReason = health.reason;
        }
      } catch (err) {
        status = 'FAIL';
        errorReason = err.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : err.message;
      }

      const responseTimeMs = Date.now() - start;

      results.push({
        ...route,
        fullUrl,
        status,
        statusCode,
        responseTimeMs,
        has404Fallback,
        hasErrorBoundary,
        errorReason,
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, routes.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Builds the Markdown Route Health Audit Report
 */
export function generateAuditReport(results, options = {}) {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '100.0';

  const chainBreakdown = {};
  for (const r of results) {
    const chain = r.networkName || `Chain ${r.chainId || 'Unknown'}`;
    chainBreakdown[chain] = chainBreakdown[chain] || { total: 0, pass: 0, fail: 0 };
    chainBreakdown[chain].total += 1;
    if (r.status === 'PASS') chainBreakdown[chain].pass += 1;
    else chainBreakdown[chain].fail += 1;
  }

  let md = `# 🕷️ Autonomous Route Health Audit Report\n\n`;
  md += `> **Audit Executed:** ${new Date().toISOString()}  \n`;
  md += `> **Target Host:** \`${options.baseUrl || 'https://staging.supersmooth.fi'}\`  \n`;
  md += `> **Coverage:** ${total} dynamic routes audited across ${Object.keys(chainBreakdown).length} networks  \n\n`;

  md += `## 📊 Executive Summary\n\n`;
  md += `| Total Routes | Passed (HTTP 200) | Failed (404/Error) | Route Health Score |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **${total}** | **${passed}** | **${failed}** | **${passRate}%** |\n\n`;

  md += `### 🌐 Network Breakdown\n\n`;
  md += `| Network | Total Routes | Passed | Failed | Health |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const [chain, stats] of Object.entries(chainBreakdown)) {
    const rate = ((stats.pass / stats.total) * 100).toFixed(0);
    const badge = stats.fail === 0 ? '🟢 100%' : `🔴 ${rate}%`;
    md += `| **${chain}** | ${stats.total} | ${stats.pass} | ${stats.fail} | ${badge} |\n`;
  }
  md += `\n`;

  if (failed > 0) {
    md += `## 🚨 Defective Routes Detected (Issue #1649)\n\n`;
    md += `| Product | Network | Protocol | Route | HTTP | Root Cause |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const f of results.filter((r) => r.status === 'FAIL')) {
      md += `| **${f.productType}** | ${f.networkName} | ${f.protocol} | \`${f.url}\` | \`${f.statusCode || 'ERR'}\` | ${f.errorReason} |\n`;
    }
    md += `\n`;
  } else {
    md += `## ✅ Clean Route Audit\n\n`;
    md += `Zero 404 boundaries or React rendering errors detected across all dynamic liquidity positions.\n\n`;
  }

  md += `## 📋 Audited Route Catalog\n\n`;
  md += `| Status | Product | Network | Protocol | Pool URL | Latency |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    md += `| ${icon} | ${r.productType} | ${r.networkName} | ${r.protocol} | \`${r.url}\` | ${r.responseTimeMs}ms |\n`;
  }

  return md;
}

/**
 * Scaffolds standard Playwright spec boilerplate for newly crawled pools
 */
export function scaffoldSpec(routes) {
  const specLines = [
    `import { test } from '../../../src/fixtures';`,
    ``,
    `/**`,
    ` * 🕷️ Autonomously Scaffolding Vault Regression Suite`,
    ` * Generated by scripts/qa-agent/crawl-vaults.js`,
    ` */`,
    `test.describe('Autonomously Crawled Vault Routes', () => {`,
  ];

  for (const r of routes) {
    specLines.push(
      `  test('verify route: ${r.productType} on ${r.networkName} (${r.protocol})', async ({ app }) => {`,
    );
    specLines.push(`    await app.vaultPage.openPage('${r.url}');`);
    specLines.push(`    await app.vaultPage.shouldBeVisible();`);
    specLines.push(`  });`);
    specLines.push(``);
  }

  specLines.push(`});`);
  return specLines.join('\n');
}

/**
 * Discovers dynamic routes across both Top Cards endpoints and Full Product Tables
 * Paginates through product catalog pages to extract all table row positions.
 */
export async function discoverAllRoutes(options = {}) {
  const fetcher = options.fetcher || universalFetch;
  const baseUrl = (options.baseUrl || 'https://staging.supersmooth.fi').replace(/\/$/, '');
  const chainFilter = options.chainFilter || null;
  const productFilter = options.productFilter || null;
  const maxPages = options.maxPages !== undefined ? options.maxPages : 10;
  const includeTables = options.includeTables !== false;
  const includeTopCards = options.includeTopCards !== false;

  const discoveredMap = new Map();

  // 1. Query Top Cards Discovery Endpoints
  if (includeTopCards) {
    for (const q of DEFAULT_DISCOVERY_QUERIES) {
      if (productFilter && q.productType !== productFilter) continue;

      const params = new URLSearchParams({
        productType: q.productType,
        filterId: q.filterId,
      });
      if (q.protocols) params.set('protocols', q.protocols);

      try {
        const res = await fetcher(`${baseUrl}/api/product-table/top-cards?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          const routes = extractRoutesFromTopCards(json, q.productType);
          for (const r of routes) {
            if (chainFilter && r.chainId !== chainFilter) continue;
            discoveredMap.set(r.url, r);
          }
        }
      } catch {
        // continue to next query
      }
    }
  }

  // 2. Query Catalog Pages and Full Product Tables across pagination
  if (includeTables) {
    for (const target of CATALOG_TARGETS) {
      if (productFilter && target.productType !== productFilter) continue;

      let pageNum = 1;
      while (pageNum <= maxPages) {
        const separator = target.path.includes('?') ? '&' : '?';
        const urlWithPage = `${baseUrl}${target.path}${separator}page=${pageNum}`;

        try {
          const res = await fetcher(urlWithPage);
          if (!res.ok) break;

          const html = await res.text();
          const routes = extractRoutesFromHtml(html, target.productType);

          let newRoutesOnPage = 0;
          for (const r of routes) {
            if (chainFilter && r.chainId !== chainFilter) continue;
            if (!discoveredMap.has(r.url)) {
              discoveredMap.set(r.url, r);
              newRoutesOnPage++;
            }
          }

          // If no position routes found on this page or no new items on subsequent page, reached end
          if (routes.length === 0 || (newRoutesOnPage === 0 && pageNum > 1)) {
            break;
          }

          pageNum++;
        } catch {
          break;
        }
      }
    }
  }

  return Array.from(discoveredMap.values());
}

/**
 * Main execution entrypoint
 */
export async function main() {
  const args = process.argv.slice(2);
  const getArg = (name, fallback) => {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.split('=')[1] : fallback;
  };

  const hasFlag = (name) => args.includes(`--${name}`);

  if (hasFlag('help')) {
    console.log(`
🕷️ Autonomous Route Crawler & Route Auditor (Aphelion-Co/aphelion-app#1649)

Usage:
  pnpm agent:crawl [options]

Options:
  --base-url=<url>     Target application host (default: https://staging.supersmooth.fi)
  --chain=<id>         Filter discovery to specific chain (1, 8453, 4663, 42161)
  --product=<type>     Filter to specific product (multiply, borrow, earn, yieldLoop)
  --concurrency=<n>    Max concurrent audit workers (default: 5)
  --max-pages=<n>      Max table pagination pages per catalog section (default: 10)
  --limit=<n>          Cap audit to first N discovered routes
  --top-cards-only     Only audit top-cards without crawling paginated tables
  --scaffold           Output auto-scaffolded Playwright spec
  --json               Output machine-readable JSON to stdout
  --help               Show this help message
`);
    return;
  }

  const baseUrl = getArg(
    'base-url',
    process.env.BASE_URL || 'https://staging.supersmooth.fi',
  ).replace(/\/$/, '');
  const chainFilter = getArg('chain', null);
  const productFilter = getArg('product', null);
  const concurrency = Number.parseInt(getArg('concurrency', '10'), 10) || 10;
  const maxPages = Number.parseInt(getArg('max-pages', '10'), 10) || 10;
  const limit = getArg('limit', null) ? Number.parseInt(getArg('limit'), 10) : null;
  const topCardsOnly = hasFlag('top-cards-only');
  const doScaffold = hasFlag('scaffold');
  const asJson = hasFlag('json');

  console.log(`🕷️ Starting Autonomous Route Crawler...`);
  console.log(`   Base Host:    ${baseUrl}`);
  console.log(`   Concurrency:  ${concurrency}`);
  console.log(
    `   Scope:        ${topCardsOnly ? 'Top Cards Only' : 'Top Cards + Full Product Tables (All Pages)'}`,
  );
  if (chainFilter)
    console.log(`   Chain Filter: ${chainFilter} (${CHAIN_NAMES[chainFilter] || 'Unknown'})`);
  if (productFilter) console.log(`   Product:      ${productFilter}`);
  if (limit) console.log(`   Audit Limit:  ${limit} routes`);

  console.log(`🔍 Discovering active liquidity routes across Top Cards and product tables...`);
  let routes = await discoverAllRoutes({
    baseUrl,
    chainFilter,
    productFilter,
    maxPages,
    includeTables: !topCardsOnly,
    includeTopCards: true,
  });

  if (limit && routes.length > limit) {
    console.log(`⚡ Capping audit to first ${limit} routes (out of ${routes.length} discovered).`);
    routes = routes.slice(0, limit);
  }

  console.log(`📦 Discovered ${routes.length} dynamic liquidity position routes.`);

  if (routes.length === 0) {
    console.log(`⚠️ No active routes resolved. Exiting.`);
    return;
  }

  // 3. Concurrently Audit Routes
  console.log(`⚡ Auditing route health across ${routes.length} targets...`);
  const results = await auditAllRoutes(routes, { baseUrl, concurrency });

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`\n🎉 Audit Completed:`);
  console.log(`   Total:  ${results.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);

  // 4. Save Reports
  const reportsDir = path.resolve(process.cwd(), 'ai-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const markdownReport = generateAuditReport(results, { baseUrl });
  const mdPath = path.join(reportsDir, 'route-health-audit.md');
  const jsonPath = path.join(reportsDir, 'latest-route-audit.json');

  fs.writeFileSync(mdPath, markdownReport, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`📝 Saved Markdown Report: ${mdPath}`);
  console.log(`📝 Saved JSON Report:     ${jsonPath}`);

  // Stream to GitHub Actions Step Summary if present
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${markdownReport}\n`, 'utf8');
      console.log(`📋 Streamed to $GITHUB_STEP_SUMMARY`);
    } catch {
      // ignore
    }
  }

  // 5. Scaffolder if requested
  if (doScaffold) {
    const scaffoldedCode = scaffoldSpec(results);
    const scaffoldPath = path.join(
      process.cwd(),
      'tests',
      'e2e',
      'no-wallet',
      'crawledVaults.spec.ts',
    );
    fs.writeFileSync(scaffoldPath, scaffoldedCode, 'utf8');
    console.log(`🛠️ Auto-scaffolded Playwright spec: ${scaffoldPath}`);
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  }

  if (failed > 0) {
    console.error(`\n🚨 Route audit detected ${failed} broken routes (404 / Error Boundaries)!`);
    process.exit(1);
  }
}

// Execution guard
if (process.argv[1]?.endsWith('crawl-vaults.js')) {
  main().catch((err) => {
    console.error(`❌ Route Crawler Fatal Error:`, err);
    process.exit(1);
  });
}
