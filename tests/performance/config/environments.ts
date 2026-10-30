import { normalizeBaseUrl } from '../../../utils/constants/urls.ts';

export interface PerformanceEnvironment {
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  testAddresses: {
    valid: string;
    unsigned: string;
    zero: string;
  };
  sampleCoins: string[];
}

let cachedDotEnv: Record<string, string> | null = null;

function loadDotEnv(): Record<string, string> {
  if (cachedDotEnv !== null) return cachedDotEnv;
  cachedDotEnv = {};

  // In k6, resolve relative to this module using import.meta.resolve() to prevent
  // relative path mismatch warnings when imported across subdirectories.
  const candidatePaths = ['../../../.env', '../../.env', './.env'];
  for (const candidate of candidatePaths) {
    try {
      const resolvedPath =
        typeof import.meta !== 'undefined' && typeof import.meta.resolve === 'function'
          ? import.meta.resolve(candidate)
          : candidate;
      const raw = open(resolvedPath);
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed
            .slice(idx + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
          cachedDotEnv[key] = val;
        }
      }
      break;
    } catch {
      // .env is optional at candidate location
    }
  }

  return cachedDotEnv;
}

export function getEnv(key: string): string | undefined {
  if (typeof __ENV[key] !== 'undefined') return __ENV[key] as string;
  return loadDotEnv()[key];
}

export function getBaseUrl(): string {
  return normalizeBaseUrl(getEnv('K6_BASE_URL') || getEnv('BASE_URL'));
}

export const performanceEnv: PerformanceEnvironment = {
  baseUrl: getBaseUrl(),
  defaultHeaders: {
    'User-Agent': 'Grafana-k6/sov-performance-tests',
    Accept: 'application/json, text/plain, */*',
  },
  testAddresses: {
    valid: '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED',
    unsigned: '0x6467e807dB1E71B9Ef04E0E3aFb962E4B0900B2B',
    zero: '0x0000000000000000000000000000000000000000',
  },
  sampleCoins: [
    'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'ethereum:0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ],
};
