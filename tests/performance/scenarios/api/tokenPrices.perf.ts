import { check, sleep } from 'k6';
import http from 'k6/http';
import type { Options } from 'k6/options';
import { getBaseUrl, performanceEnv } from '../../config/environments.ts';
import { getProfileOptions } from '../../config/profiles.ts';

export const options: Options = getProfileOptions();
const BASE_URL = getBaseUrl();

export function runTokenPricesDefault(): void {
  const resDefault = http.get(`${BASE_URL}/api/token-prices/current`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/token-prices/current (default)', type: 'api_fast' },
  });

  check(resDefault, {
    'token prices status is 200': (r) => r.status === 200,
    'token prices response has prices object': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body && typeof body.prices === 'object';
      } catch {
        return false;
      }
    },
  });
}

export function runTokenPricesFiltered(): void {
  const coins = performanceEnv.sampleCoins.join(',');
  const resCoins = http.get(
    `${BASE_URL}/api/token-prices/current?coins=${encodeURIComponent(coins)}`,
    {
      headers: performanceEnv.defaultHeaders,
      tags: { name: 'GET /api/token-prices/current (filtered)', type: 'api_fast' },
    },
  );

  check(resCoins, {
    'filtered prices status is 200': (r) => r.status === 200,
    'filtered prices has entries': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body && Object.keys(body.prices || {}).length > 0;
      } catch {
        return false;
      }
    },
  });
}

export function runTokenPricesScenario(): void {
  runTokenPricesDefault();
  sleep(0.2);
  runTokenPricesFiltered();
  sleep(0.3);
}

export default function (): void {
  runTokenPricesScenario();
}
