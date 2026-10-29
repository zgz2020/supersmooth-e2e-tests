import { check, sleep } from 'k6';
import http from 'k6/http';
import type { Options } from 'k6/options';
import { getBaseUrl, performanceEnv } from '../../config/environments.ts';
import { getProfileOptions } from '../../config/profiles.ts';

export const options: Options = getProfileOptions();
const BASE_URL = getBaseUrl();

export function runComplianceGeo(): void {
  const geoRes = http.get(`${BASE_URL}/api/compliance/geo`, {
    headers: performanceEnv.defaultHeaders,
    tags: { name: 'GET /api/compliance/geo', type: 'api_fast' },
  });

  check(geoRes, {
    'geo check status is 200': (r) => r.status === 200,
    'geo check returned country/allowed': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body && ('allowed' in body || 'country' in body || 'isAllowed' in body);
      } catch {
        return false;
      }
    },
  });
}

export function runComplianceScreen(): void {
  // Matches tests/api/complianceScreen.spec.ts schema: { wallet, context }
  const screenPayload = JSON.stringify({
    wallet: performanceEnv.testAddresses.valid,
    context: 'connect',
  });

  const screenRes = http.post(`${BASE_URL}/api/compliance/screen`, screenPayload, {
    headers: {
      ...performanceEnv.defaultHeaders,
      'Content-Type': 'application/json',
      Origin: BASE_URL,
    },
    tags: { name: 'POST /api/compliance/screen', type: 'api_fast' },
  });

  check(screenRes, {
    'screen check executed': (r) => r.status === 200 || r.status === 201,
  });
}

export function runComplianceScenario(): void {
  runComplianceGeo();
  sleep(0.2);
  runComplianceScreen();
  sleep(0.3);
}

export default function (): void {
  runComplianceScenario();
}
