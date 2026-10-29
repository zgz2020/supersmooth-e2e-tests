import { check, sleep } from 'k6';
import http from 'k6/http';
import type { Options } from 'k6/options';
import { getBaseUrl } from '../../config/environments.ts';
import { getProfileOptions } from '../../config/profiles.ts';

export const options: Options = getProfileOptions();
const BASE_URL = getBaseUrl();

export const PAGES = [
  '/',
  '/products/earn',
  '/products/borrow',
  '/products/trade',
  '/products/multiply',
  '/migrate',
];

export function normalizePagePath(page: string): string {
  const p = page.trim();
  if (p === '/' || p === 'home' || p === 'root') return '/';
  if (p === 'earn' || p === '/earn' || p === '/products/earn') return '/products/earn';
  if (p === 'borrow' || p === '/borrow' || p === '/products/borrow') return '/products/borrow';
  if (p === 'trade' || p === '/trade' || p === '/products/trade') return '/products/trade';
  if (p === 'multiply' || p === '/multiply' || p === '/products/multiply')
    return '/products/multiply';
  if (p === 'migrate' || p === '/migrate') return '/migrate';
  return p.startsWith('/') ? p : `/${p}`;
}

export function runSinglePage(page: string): void {
  const normalized = normalizePagePath(page);
  const res = http.get(`${BASE_URL}${normalized}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    tags: { name: `PAGE ${normalized}`, type: 'web' },
  });

  check(res, {
    [`page ${normalized} returned 200`]: (r) => r.status === 200,
  });
}

export function runPageNavigationScenario(selectedPages?: string[]): void {
  const targetPages = selectedPages && selectedPages.length > 0 ? selectedPages : PAGES;
  for (let i = 0; i < targetPages.length; i++) {
    runSinglePage(targetPages[i]);
    if (i < targetPages.length - 1) {
      sleep(0.5);
    }
  }
}

export default function (): void {
  runPageNavigationScenario();
}
