import { check, sleep } from 'k6';
import http from 'k6/http';
import type { Options } from 'k6/options';
import { getBaseUrl, performanceEnv } from '../../config/environments.ts';
import { getProfileOptions } from '../../config/profiles.ts';

export const options: Options = getProfileOptions();
const BASE_URL = getBaseUrl();

export function runProductTopCards(): void {
  // Matches tests/api/productTableTopCards.spec.ts: /api/product-table/top-cards with mandatory params
  const res = http.get(
    `${BASE_URL}/api/product-table/top-cards?productType=earn&filterId=most-liquidity`,
    {
      headers: performanceEnv.defaultHeaders,
      tags: { name: 'GET /api/product-table/top-cards', type: 'api_agg' },
    },
  );

  check(res, {
    'product table top cards responds 200': (r) => r.status === 200,
  });
}

export function runEffectiveSpread(): void {
  // Matches tests/api/effectiveSpread.spec.ts: requires chainId and product ('borrow' | 'multiply' | 'yieldLoop')
  const res = http.get(`${BASE_URL}/api/effective-spread?chainId=8453&product=borrow`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/effective-spread', type: 'api_agg' },
  });

  check(res, {
    'effective spread responds 200': (r) => r.status === 200,
  });
}

export function runMigrateEarnPositions(): void {
  const address = encodeURIComponent(performanceEnv.testAddresses.valid);
  const res = http.get(`${BASE_URL}/api/migrate/earn-positions?address=${address}`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/migrate/earn-positions', type: 'api_agg' },
  });

  check(res, {
    'migrate earn positions responds 200': (r) => r.status === 200,
  });
}

export function runMigrateAdoptableSafes(): void {
  const address = encodeURIComponent(performanceEnv.testAddresses.valid);
  const res = http.get(`${BASE_URL}/api/migrate/adoptable-safes?address=${address}`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/migrate/adoptable-safes', type: 'api_agg' },
  });

  check(res, {
    'migrate adoptable safes responds 200': (r) => r.status === 200,
  });
}

export function runProductsScenario(): void {
  runProductTopCards();
  sleep(0.2);
  runEffectiveSpread();
  sleep(0.2);
  runMigrateEarnPositions();
  sleep(0.2);
  runMigrateAdoptableSafes();
  sleep(0.3);
}

export default function (): void {
  runProductsScenario();
}
