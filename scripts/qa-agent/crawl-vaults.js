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
 *   1. HTTP 200 OK, and no 404 / error text in the server-rendered HTML
 *   2. The page actually loads in a browser (skip with --no-render): the server
 *      HTML is only a skeleton, so a bad pool still returns 200 and shows its
 *      error ("This page doesn't exist", an error boundary, ...) client-side.
 *      A page counts as loaded when its "Open <Product> Position" heading and
 *      its "Configure Position" side panel are visible.
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
 * Rendered page-load check.
 *
 * Healthy vault pages (every product and protocol) show an "Open <Product>
 * Position" heading and a "Configure Position" side-panel heading once they
 * have loaded. That pair is the positive "page loaded" signal. Known error
 * screens are only matched to fail fast and to name the cause; a page that
 * shows neither the signal nor a known error still fails when time runs out.
 */
export const LOADED_HEADINGS = {
  pageHeading: /^open .+ position$/i,
  sidePanel: /^configure position$/i,
};

export const KNOWN_ERROR_SCREENS = [
  {
    kind: 'not-found',
    pattern: /this page doesn['’]t exist|this page could not be found|page not found/i,
  },
  { kind: 'error-screen', pattern: /application error: a (client|server)-side exception/i },
  { kind: 'error-screen', pattern: /something went wrong/i },
  { kind: 'error-screen', pattern: /invalid market identifier/i },
  { kind: 'error-screen', pattern: /internal server error/i },
];

/** Returns the line of `text` that matches `pattern`, trimmed for a report. */
function matchingLine(text, pattern) {
  const line = text.split('\n').find((l) => pattern.test(l)) || '';
  const trimmed = line.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

/**
 * Classifies one snapshot of a rendered page.
 *
 * @param {{ headings: string[], text: string, skeletonCount: number }} snapshot
 *   Visible headings (h1-h3), visible body text and visible `.animate-pulse` skeletons.
 * @param {{ final?: boolean, waitedMs?: number }} [options]
 *   `final` is true once time has run out, so a page still without the loaded
 *   signal is reported as stuck or incomplete instead of pending.
 * @returns {{ state: 'loaded' | 'failed' | 'pending', kind?: string, reason: string }}
 */
export function classifyRenderedPage(snapshot, options = {}) {
  const headings = (snapshot?.headings || []).map((h) => String(h).trim());
  const text = String(snapshot?.text || '');
  const skeletonCount = snapshot?.skeletonCount || 0;

  const hasPageHeading = headings.some((h) => LOADED_HEADINGS.pageHeading.test(h));
  const hasSidePanel = headings.some((h) => LOADED_HEADINGS.sidePanel.test(h));
  if (hasPageHeading && hasSidePanel) {
    return { state: 'loaded', reason: 'OK' };
  }

  // Error text in a heading counts at once (the app's not-found and error pages
  // use an <h1>). Error text elsewhere only counts once the page has stopped
  // loading (no skeletons left) or time has run out: "Something went wrong"
  // can also be ordinary text (an FAQ, the simulation alert), and #1688's
  // "Invalid market identifier" is plain text with no visible heading.
  const settled = skeletonCount === 0 || options.final;
  for (const screen of KNOWN_ERROR_SCREENS) {
    const heading = headings.find((h) => screen.pattern.test(h));
    const inText = !heading && settled && screen.pattern.test(text);
    if (heading || inText) {
      const shown = heading
        ? matchingLine(heading, screen.pattern)
        : matchingLine(text, screen.pattern);
      const label = screen.kind === 'not-found' ? 'Not-found screen' : 'Error screen';
      return {
        state: 'failed',
        kind: screen.kind,
        reason: `${label} despite HTTP 200: "${shown}"`,
      };
    }
  }

  if (!options.final) {
    return { state: 'pending', reason: 'Still loading' };
  }

  const waited = options.waitedMs ? ` after ${options.waitedMs}ms` : '';
  if (skeletonCount > 0) {
    return {
      state: 'failed',
      kind: 'stuck-loading',
      reason: `Stuck on loading skeleton${waited} (${skeletonCount} placeholders still visible)`,
    };
  }

  const missing = [
    !hasPageHeading && '"Open … Position" heading',
    !hasSidePanel && '"Configure Position" side panel',
  ].filter(Boolean);
  const seen = headings.length > 0 ? headings.slice(0, 3).join(' | ') : 'none';
  return {
    state: 'failed',
    kind: 'missing-content',
    reason: `Main content missing${waited}: no ${missing.join(' or ')} (headings: ${seen})`,
  };
}

/** Runs in the browser: collects what classifyRenderedPage needs. */
function collectPageSnapshot() {
  const document = globalThis.document;
  const isVisible = (el) =>
    typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null;
  return {
    headings: Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter(isVisible)
      .map((el) => el.innerText.trim()),
    text: (document.body?.innerText || '').slice(0, 20000),
    skeletonCount: Array.from(document.querySelectorAll('.animate-pulse')).filter(isVisible).length,
  };
}

/**
 * Takes a page snapshot, giving up after `timeoutMs`: `page.evaluate` has no
 * timeout of its own, so a tab hung by a script would block the worker forever.
 * Returns `{ snapshot }`, `{ hung: true }`, or `{ error }` when the evaluate
 * failed (e.g. the page navigated mid-call); callers treat that as still loading.
 */
async function takeSnapshot(page, timeoutMs) {
  let timer;
  const hung = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ hung: true }), timeoutMs);
  });
  try {
    return await Promise.race([
      page.evaluate(collectPageSnapshot).then(
        (snapshot) => ({ snapshot }),
        (error) => ({ error }),
      ),
      hung,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens one route in a browser page and waits for it to load or fail.
 *
 * An error screen has to stay up for `errorSettleMs` before it counts, so a
 * screen shown for a moment while data loads is not reported.
 */
export async function checkRenderedPage(page, fullUrl, options = {}) {
  const timeoutMs = options.timeoutMs || 20000;
  const pollMs = options.pollMs || 500;
  const errorSettleMs = options.errorSettleMs ?? 1500;
  const snapshotTimeoutMs = options.snapshotTimeoutMs || 5000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now || Date.now;

  let pageError = null;
  page.on?.('pageerror', (err) => {
    pageError = pageError || String(err?.message || err).split('\n')[0];
  });

  const start = now();
  const withPageError = (result) =>
    pageError && result.state === 'failed'
      ? { ...result, reason: `${result.reason}; uncaught error: ${pageError.slice(0, 120)}` }
      : result;

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch (err) {
    return {
      state: 'failed',
      kind: 'navigation',
      reason: `Browser navigation failed: ${String(err?.message || err).split('\n')[0]}`,
    };
  }

  const unresponsive = {
    state: 'failed',
    kind: 'unresponsive',
    reason: `Page stopped responding (no snapshot within ${snapshotTimeoutMs}ms)`,
  };

  let failingSince = null;
  let last = { state: 'pending', reason: 'Still loading' };
  while (now() - start < timeoutMs) {
    const taken = await takeSnapshot(page, snapshotTimeoutMs);
    if (taken.hung) return withPageError(unresponsive);
    if (taken.error) {
      await sleep(pollMs);
      continue;
    }
    last = classifyRenderedPage(taken.snapshot);
    if (last.state === 'loaded') return last;
    if (last.state === 'failed') {
      failingSince = failingSince ?? now();
      if (now() - failingSince >= errorSettleMs) return withPageError(last);
    } else {
      failingSince = null;
    }
    await sleep(pollMs);
  }

  const taken = await takeSnapshot(page, snapshotTimeoutMs);
  if (taken.hung) return withPageError(unresponsive);
  if (taken.error) {
    return withPageError({
      state: 'failed',
      kind: 'render-error',
      reason: `Could not read the page: ${String(taken.error?.message || taken.error).split('\n')[0]}`,
    });
  }
  return withPageError(classifyRenderedPage(taken.snapshot, { final: true, waitedMs: timeoutMs }));
}

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);

async function launchChromium() {
  const { chromium } = await import('@playwright/test');
  return chromium.launch();
}

/** Failures that cost the full timeout; many of them at once point to staging being down. */
const SLOW_FAILURE_KINDS = new Set([
  'stuck-loading',
  'missing-content',
  'unresponsive',
  'navigation',
]);

/**
 * Runs the rendered page-load check on every route that passed the HTTP
 * check, and turns those that do not load into FAILs with a reason.
 * Routes that already failed are returned unchanged.
 *
 * Staging slows down under many parallel renders, and pages then sit on their
 * skeletons past the timeout. So concurrency is kept low (default 4) and pages
 * that fail are checked once more, one at a time, before they are reported.
 * A page that only loads on that second try passes with `renderRetried: true`.
 *
 * When staging itself is down (frontend up, data not loading) every page costs
 * the full timeout, and checking and retrying them all would take hours. So:
 *   - if the first `earlyStopAfter` pages (default 20) all fail slowly, the
 *     check stops and the rest are reported as not checked;
 *   - the retry is skipped when more than `maxRetryRate` (default 20%) of the
 *     pages failed (and more than 10, so a small run still retries a flaky
 *     page), and covers at most `maxRetries` pages (default 50).
 */
export async function auditRenderedRoutes(results, options = {}) {
  const baseUrl = (options.baseUrl || 'https://staging.supersmooth.fi').replace(/\/$/, '');
  const concurrency = options.concurrency || 4;
  const retries = options.retries ?? 1;
  const earlyStopAfter = options.earlyStopAfter ?? 20;
  const maxRetryRate = options.maxRetryRate ?? 0.2;
  const maxRetries = options.maxRetries ?? 50;
  const launch = options.launchBrowser || launchChromium;
  const toCheck = results.filter((r) => r.status === 'PASS');
  if (toCheck.length === 0) return results;

  const browser = await launch();

  async function checkOne(context, result) {
    const page = await context.newPage();
    const start = Date.now();
    let outcome;
    try {
      outcome = await checkRenderedPage(page, result.fullUrl || `${baseUrl}${result.url}`, {
        timeoutMs: options.timeoutMs,
        errorSettleMs: options.errorSettleMs,
        snapshotTimeoutMs: options.snapshotTimeoutMs,
      });
    } catch (err) {
      outcome = {
        state: 'failed',
        kind: 'render-error',
        reason: `Render check crashed: ${err.message}`,
      };
    } finally {
      await page.close().catch(() => {});
    }
    return { ...outcome, renderTimeMs: Date.now() - start };
  }

  // Checks `items`; with `watchForOutage`, stops once the first pages all fail slowly.
  async function checkAll(items, workers, { watchForOutage = false } = {}) {
    const outcomes = new Map();
    const queue = [...items];
    let completed = 0;
    let slowFailures = 0;
    let stopped = false;
    async function worker() {
      const context = await browser.newContext();
      // Images, fonts and media do not decide whether the page loaded; skipping them saves time.
      await context.route?.('**/*', (route) =>
        BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())
          ? route.abort()
          : route.fallback(),
      );
      try {
        while (queue.length > 0 && !stopped) {
          const result = queue.shift();
          if (!result) break;
          const outcome = await checkOne(context, result);
          outcomes.set(result, outcome);
          completed += 1;
          if (outcome.state !== 'loaded' && SLOW_FAILURE_KINDS.has(outcome.kind)) slowFailures += 1;
          if (
            watchForOutage &&
            earlyStopAfter > 0 &&
            completed === earlyStopAfter &&
            slowFailures === completed
          ) {
            stopped = true;
          }
        }
      } finally {
        await context.close().catch(() => {});
      }
    }
    await Promise.all(Array.from({ length: Math.min(workers, items.length) }, () => worker()));
    return { outcomes, stopped };
  }

  const final = new Map();
  let notChecked = null;
  let retryNote = null;
  try {
    const first = await checkAll(toCheck, concurrency, { watchForOutage: true });
    for (const [result, outcome] of first.outcomes) final.set(result, { ...outcome, attempts: 1 });

    if (first.stopped) {
      notChecked = `Not checked: the first ${earlyStopAfter} pages all failed to load, so staging looks down`;
    } else {
      const failed = toCheck.filter((r) => final.get(r).state !== 'loaded');
      const rate = failed.length / toCheck.length;
      if (retries > 0 && failed.length > 0) {
        if (rate > maxRetryRate && failed.length > 10) {
          retryNote = `not retried: ${failed.length} of ${toCheck.length} pages failed (${Math.round(rate * 100)}%), staging looks down`;
        } else {
          const toRetry = failed.slice(0, maxRetries);
          if (failed.length > toRetry.length) {
            retryNote = `not retried: over the ${maxRetries}-page retry limit`;
          }
          const second = await checkAll(toRetry, 1);
          for (const [result, outcome] of second.outcomes) {
            final.set(result, { ...outcome, attempts: 2 });
          }
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const checked = new Set(toCheck);
  return results.map((r) => {
    const outcome = final.get(r);
    if (!outcome) {
      if (!checked.has(r)) return r;
      return {
        ...r,
        status: 'FAIL',
        renderStatus: 'NOT_CHECKED',
        failureKind: 'not-checked',
        errorReason: notChecked,
      };
    }
    const { renderTimeMs, attempts } = outcome;
    if (outcome.state === 'loaded') {
      return { ...r, renderStatus: 'LOADED', renderTimeMs, renderRetried: attempts > 1 };
    }
    let errorReason = outcome.reason;
    if (attempts > 1) errorReason += ` (failed ${attempts} tries)`;
    else if (retryNote) errorReason += ` (${retryNote})`;
    return {
      ...r,
      status: 'FAIL',
      renderStatus: 'FAILED',
      renderTimeMs,
      renderAttempts: attempts,
      failureKind: outcome.kind,
      has404Fallback: outcome.kind === 'not-found',
      hasErrorBoundary: outcome.kind === 'error-screen',
      errorReason,
    };
  });
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
  md += `> **Coverage:** ${total} dynamic routes audited across ${Object.keys(chainBreakdown).length} networks  \n`;
  md += `> **Checks:** ${options.render === false ? 'HTTP status and server HTML only (page-load check skipped)' : 'HTTP status, server HTML, and page load in a browser'}  \n\n`;

  md += `## 📊 Executive Summary\n\n`;
  md += `| Total Routes | Passed | Failed | Route Health Score |\n`;
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
    md += `Every route returned HTTP 200${options.render === false ? '' : ' and loaded in the browser'}.\n\n`;
  }

  md += `## 📋 Audited Route Catalog\n\n`;
  md += `| Status | Product | Network | Protocol | Pool URL | Latency | Page Load |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    const load = r.renderTimeMs !== undefined ? `${r.renderTimeMs}ms` : '—';
    md += `| ${icon} | ${r.productType} | ${r.networkName} | ${r.protocol} | \`${r.url}\` | ${r.responseTimeMs}ms | ${load} |\n`;
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
  const allPages = options.allPages === true;
  const maxPages = allPages
    ? Number.POSITIVE_INFINITY
    : options.maxPages !== undefined
      ? options.maxPages
      : 10;
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
            if (chainFilter && String(r.chainId) !== String(chainFilter)) continue;
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

      const seenTargetUrls = new Set();
      let pageNum = 1;
      while (pageNum <= maxPages) {
        const separator = target.path.includes('?') ? '&' : '?';
        const urlWithPage = `${baseUrl}${target.path}${separator}page=${pageNum}`;

        let res;
        try {
          res = await fetcher(urlWithPage);
        } catch (err) {
          // Retry once on transient network glitch
          await new Promise((resolve) => setTimeout(resolve, 500));
          try {
            res = await fetcher(urlWithPage);
          } catch {
            console.warn(
              `⚠️ [crawler] Failed to fetch page ${pageNum} for ${target.name}: ${err?.message || err}`,
            );
            break;
          }
        }
        if (!res || !res.ok) break;

        try {
          const html = await res.text();
          const routes = extractRoutesFromHtml(html, target.productType);

          let globalNewOnPage = 0;
          for (const r of routes) {
            if (!seenTargetUrls.has(r.url)) {
              seenTargetUrls.add(r.url);
              globalNewOnPage++;
            }
            if (chainFilter && String(r.chainId) !== String(chainFilter)) continue;
            if (!discoveredMap.has(r.url)) {
              discoveredMap.set(r.url, r);
            }
          }

          // Only break if the catalog page itself is empty or returning looped/duplicate cards
          if (routes.length === 0 || (globalNewOnPage === 0 && pageNum > 1)) {
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
  --all-pages          Crawl all paginated table pages until the catalog ends naturally
  --limit=<n>          Cap audit to first N discovered routes
  --top-cards-only     Only audit top-cards without crawling paginated tables
  --no-render          Skip the browser page-load check (HTTP status and server HTML only)
  --render-timeout=<ms> Time a page gets to load in the browser (default: 20000)
  --render-concurrency=<n> Pages loaded in the browser at once (default: 4)
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
  const allPages = hasFlag('all-pages');
  const maxPages = allPages
    ? Number.POSITIVE_INFINITY
    : Number.parseInt(getArg('max-pages', '10'), 10) || 10;
  const limit = getArg('limit', null) ? Number.parseInt(getArg('limit'), 10) : null;
  const topCardsOnly = hasFlag('top-cards-only');
  const doScaffold = hasFlag('scaffold');
  const asJson = hasFlag('json');
  const render = !hasFlag('no-render');
  const renderTimeoutMs = Number.parseInt(getArg('render-timeout', '20000'), 10) || 20000;
  const renderConcurrency = Number.parseInt(getArg('render-concurrency', '4'), 10) || 4;

  let scopeLabel = 'Top Cards + Product Tables (First 10 Pages)';
  if (topCardsOnly) {
    scopeLabel = 'Top Cards Only';
  } else if (allPages) {
    scopeLabel = 'Top Cards + Full Product Tables (All Pages / Exhaustive)';
  }

  console.log(`🕷️ Starting Autonomous Route Crawler...`);
  console.log(`   Base Host:    ${baseUrl}`);
  console.log(`   Concurrency:  ${concurrency}`);
  console.log(`   Scope:        ${scopeLabel}`);
  if (chainFilter)
    console.log(`   Chain Filter: ${chainFilter} (${CHAIN_NAMES[chainFilter] || 'Unknown'})`);
  if (productFilter) console.log(`   Product:      ${productFilter}`);
  if (limit) console.log(`   Audit Limit:  ${limit} routes`);
  console.log(
    `   Page Load:    ${render ? `browser check (${renderConcurrency} at once, timeout ${renderTimeoutMs}ms)` : 'skipped (--no-render)'}`,
  );

  console.log(`🔍 Discovering active liquidity routes across Top Cards and product tables...`);
  let routes = await discoverAllRoutes({
    baseUrl,
    chainFilter,
    productFilter,
    maxPages,
    allPages,
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
  let results = await auditAllRoutes(routes, { baseUrl, concurrency });

  if (render) {
    const httpPassed = results.filter((r) => r.status === 'PASS').length;
    console.log(`🖥️  Checking that ${httpPassed} pages load in the browser...`);
    const renderStart = Date.now();
    results = await auditRenderedRoutes(results, {
      baseUrl,
      concurrency: renderConcurrency,
      timeoutMs: renderTimeoutMs,
    });
    const retried = results.filter((r) => r.renderRetried).length;
    if (retried > 0) console.log(`   ${retried} pages only loaded on their second try`);
    console.log(`   Page-load check took ${Math.round((Date.now() - renderStart) / 1000)}s`);
  }

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

  const markdownReport = generateAuditReport(results, { baseUrl, render });
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
    console.error(`\n🚨 Route audit detected ${failed} broken routes:`);
    const failures = results.filter((r) => r.status === 'FAIL');
    for (const f of failures.slice(0, 30)) {
      console.error(`   ❌ ${f.url}\n      ${f.errorReason}`);
    }
    if (failures.length > 30) {
      console.error(`   … and ${failures.length - 30} more (see ai-reports/route-health-audit.md)`);
    }
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
