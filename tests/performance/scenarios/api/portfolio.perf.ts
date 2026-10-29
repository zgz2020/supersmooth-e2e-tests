import { check, sleep } from 'k6';
import http from 'k6/http';
import type { Options } from 'k6/options';
import { getBaseUrl, performanceEnv } from '../../config/environments.ts';
import { getProfileOptions } from '../../config/profiles.ts';

export const options: Options = getProfileOptions();
const BASE_URL = getBaseUrl();

export function runPortfolioSafes(): void {
  const address = encodeURIComponent(performanceEnv.testAddresses.valid);
  const res = http.get(`${BASE_URL}/api/portfolio/safes?address=${address}`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/portfolio/safes', type: 'api_agg' },
  });

  check(res, {
    'portfolio safes responds 200': (r) => r.status === 200,
  });
}

export function runPortfolioSummary(): void {
  const address = encodeURIComponent(performanceEnv.testAddresses.valid);
  const res = http.get(`${BASE_URL}/api/portfolio/summary?address=${address}`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/portfolio/summary', type: 'api_agg' },
  });

  check(res, {
    'portfolio summary responds 200': (r) => r.status === 200,
  });
}

export function runPortfolioStrategies(): void {
  const res = http.get(`${BASE_URL}/api/portfolio/recommended-strategies`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/portfolio/recommended-strategies', type: 'api_agg' },
  });

  check(res, {
    'recommended strategies responds 200': (r) => r.status === 200,
  });
}

export function runPortfolioTerms(): void {
  const address = encodeURIComponent(performanceEnv.testAddresses.valid);
  const res = http.get(`${BASE_URL}/api/terms/status?address=${address}`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/terms/status', type: 'api_agg' },
  });

  check(res, {
    'terms status responds 200': (r) => r.status === 200,
  });
}

export function runPortfolioScenario(): void {
  runPortfolioSafes();
  sleep(0.2);
  runPortfolioSummary();
  sleep(0.2);
  runPortfolioStrategies();
  sleep(0.2);
  runPortfolioTerms();
  sleep(0.3);
}

export default function (): void {
  runPortfolioScenario();
}
