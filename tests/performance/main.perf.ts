import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { getBaseUrl, getEnv } from './config/environments.ts';
import { getProfileOptions } from './config/profiles.ts';
import {
  extractChecks,
  formatDuration,
  generateHtmlReport,
  generateTextSummary,
  getMetricValues,
  PerformanceSummary,
  RunHistoryItem,
} from './reporter.ts';
import {
  runComplianceGeo,
  runComplianceScenario,
  runComplianceScreen,
} from './scenarios/api/compliance.perf.ts';
import {
  runPortfolioSafes,
  runPortfolioScenario,
  runPortfolioStrategies,
  runPortfolioSummary,
  runPortfolioTerms,
} from './scenarios/api/portfolio.perf.ts';
import {
  runEffectiveSpread,
  runMigrateAdoptableSafes,
  runMigrateEarnPositions,
  runProductsScenario,
  runProductTopCards,
} from './scenarios/api/products.perf.ts';
import { runRpcScenario } from './scenarios/api/rpc.perf.ts';
import {
  runTokenPricesDefault,
  runTokenPricesFiltered,
  runTokenPricesScenario,
} from './scenarios/api/tokenPrices.perf.ts';
import { runPageNavigationScenario, runSinglePage } from './scenarios/web/pageNavigation.perf.ts';

export const options: Options = getProfileOptions();

let cachedHistory: RunHistoryItem[] = [];

try {
  // k6 resolves open() relative to this script's directory (tests/performance/)
  const rawHistory = open('../../performance-reports/history/runs.json');
  cachedHistory = JSON.parse(rawHistory);
  if (!Array.isArray(cachedHistory)) {
    cachedHistory = [];
  }
} catch {
  cachedHistory = [];
}

export function handleSummary(data: PerformanceSummary): Record<string, string> {
  const targetUrl = getBaseUrl();
  const profile = getEnv('K6_PROFILE') || 'smoke';
  const rawTarget = getEnv('K6_TARGET') || getEnv('TARGET') || getEnv('K6_SCENARIO') || 'all';
  const cleanTarget = rawTarget.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const runId = `${timestamp}_${profile}_${cleanTarget}`;

  const checks = extractChecks(data);
  const metrics = data.metrics || {};
  const duration = getMetricValues(metrics.http_req_duration);
  const reqs = getMetricValues(metrics.http_reqs);
  const failed = getMetricValues(metrics.http_req_failed);

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const allChecksPassed = totalChecks > 0 && passedChecks === totalChecks;
  const checksPassRate =
    totalChecks > 0 ? `${((passedChecks / totalChecks) * 100).toFixed(1)}%` : '100.0%';
  const failedRate = `${((failed.rate ?? 0) * 100).toFixed(2)}%`;
  const dateFormatted = now.toISOString().replace('T', ' ').slice(0, 19);

  const currentRunItem: RunHistoryItem = {
    id: runId,
    timestamp: now.toISOString(),
    dateFormatted,
    profile,
    target: rawTarget,
    totalRequests: reqs.count || 0,
    requestsRate: Number((reqs.rate || 0).toFixed(2)),
    p95Latency: formatDuration(duration['p(95)']),
    checksPassRate,
    failedRate,
    allChecksPassed,
    reportFile: `report-${runId}.html`,
  };

  const updatedHistory = [currentRunItem, ...cachedHistory].slice(0, 20);

  const rootReportHtml = generateHtmlReport(data, targetUrl, updatedHistory, false);
  const archiveReportHtml = generateHtmlReport(data, targetUrl, updatedHistory, true);
  const jsonSummary = JSON.stringify(data, null, 2);
  const historyJson = JSON.stringify(updatedHistory, null, 2);

  return {
    'performance-reports/report.html': rootReportHtml,
    'performance-reports/summary.json': jsonSummary,
    'performance-reports/history/runs.json': historyJson,
    [`performance-reports/history/report-${runId}.html`]: archiveReportHtml,
    [`performance-reports/history/summary-${runId}.json`]: jsonSummary,
    stdout: generateTextSummary(data),
  };
}

export type TargetFn = () => void;

function runAllFlow(): void {
  runPageNavigationScenario();
  sleep(0.5);
  runTokenPricesScenario();
  sleep(0.3);
  runProductsScenario();
  sleep(0.3);
  runComplianceScenario();
  sleep(0.3);
  runPortfolioScenario();
  sleep(0.3);
  runRpcScenario();
  sleep(0.5);
}

function runApiFlow(): void {
  runTokenPricesScenario();
  sleep(0.3);
  runComplianceScenario();
  sleep(0.3);
  runProductsScenario();
  sleep(0.3);
  runPortfolioScenario();
  sleep(0.3);
  runRpcScenario();
}

export const TARGET_REGISTRY: Record<string, TargetFn> = {
  // Suites
  all: runAllFlow,
  api: runApiFlow,
  web: runPageNavigationScenario,

  // Web Pages
  '/': () => runSinglePage('/'),
  home: () => runSinglePage('/'),
  root: () => runSinglePage('/'),
  '/earn': () => runSinglePage('/products/earn'),
  earn: () => runSinglePage('/products/earn'),
  '/products/earn': () => runSinglePage('/products/earn'),
  '/borrow': () => runSinglePage('/products/borrow'),
  borrow: () => runSinglePage('/products/borrow'),
  '/products/borrow': () => runSinglePage('/products/borrow'),
  '/trade': () => runSinglePage('/products/trade'),
  trade: () => runSinglePage('/products/trade'),
  '/products/trade': () => runSinglePage('/products/trade'),
  '/multiply': () => runSinglePage('/products/multiply'),
  multiply: () => runSinglePage('/products/multiply'),
  '/products/multiply': () => runSinglePage('/products/multiply'),
  '/migrate': () => runSinglePage('/migrate'),
  migrate: () => runSinglePage('/migrate'),

  // Token prices
  tokens: runTokenPricesScenario,
  'token-prices': runTokenPricesScenario,
  '/api/token-prices/current': runTokenPricesScenario,
  'tokens:default': runTokenPricesDefault,
  'tokens:filtered': runTokenPricesFiltered,

  // Compliance
  compliance: runComplianceScenario,
  geo: runComplianceGeo,
  'compliance:geo': runComplianceGeo,
  '/api/compliance/geo': runComplianceGeo,
  screen: runComplianceScreen,
  'compliance:screen': runComplianceScreen,
  '/api/compliance/screen': runComplianceScreen,

  // Portfolio
  portfolio: runPortfolioScenario,
  safes: runPortfolioSafes,
  '/api/portfolio/safes': runPortfolioSafes,
  summary: runPortfolioSummary,
  '/api/portfolio/summary': runPortfolioSummary,
  strategies: runPortfolioStrategies,
  '/api/portfolio/recommended-strategies': runPortfolioStrategies,
  terms: runPortfolioTerms,
  '/api/terms/status': runPortfolioTerms,

  // Products & Migration
  products: runProductsScenario,
  'top-cards': runProductTopCards,
  '/api/product-table/top-cards': runProductTopCards,
  '/api/product-table-top-cards': runProductTopCards,
  spread: runEffectiveSpread,
  '/api/effective-spread': runEffectiveSpread,
  'migrate-earn': runMigrateEarnPositions,
  '/api/migrate/earn-positions': runMigrateEarnPositions,
  'migrate-safes': runMigrateAdoptableSafes,
  '/api/migrate/adoptable-safes': runMigrateAdoptableSafes,

  // RPC
  rpc: runRpcScenario,
  '/api/rpc': runRpcScenario,
  '/api/rpc/8453': runRpcScenario,
};

export function resolveTargets(rawQuery?: string): TargetFn[] {
  const query = (rawQuery || '').trim().toLowerCase();
  if (!query || query === 'all') {
    return [runAllFlow];
  }

  const tokens = query
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const matchedFns: TargetFn[] = [];

  for (const token of tokens) {
    if (TARGET_REGISTRY[token]) {
      matchedFns.push(TARGET_REGISTRY[token]);
    } else {
      console.warn(
        `[k6] Warning: Unknown target "${token}". Run "pnpm test:performance:menu" to view available targets.`,
      );
    }
  }

  return matchedFns.length > 0 ? matchedFns : [runAllFlow];
}

const activeTargetQuery = getEnv('K6_TARGET') || getEnv('TARGET') || getEnv('K6_SCENARIO') || 'all';
const activeTargets = resolveTargets(activeTargetQuery);

export default function (): void {
  for (let i = 0; i < activeTargets.length; i++) {
    activeTargets[i]();
    if (i < activeTargets.length - 1) {
      sleep(0.3);
    }
  }
}
