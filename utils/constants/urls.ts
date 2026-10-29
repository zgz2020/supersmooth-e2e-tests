/**
 * Centralized URL constants and normalization utilities.
 */

export const DEFAULT_BASE_URL = 'https://staging.supersmooth.fi';

/**
 * Normalizes a base URL by removing any trailing slashes and providing a default fallback.
 *
 * @param url Optional URL string to normalize.
 * @param fallback Optional fallback URL if `url` is not provided or empty (defaults to DEFAULT_BASE_URL).
 * @returns Clean normalized URL without trailing slashes.
 */
export function normalizeBaseUrl(url?: string, fallback: string = DEFAULT_BASE_URL): string {
  const base = (url || '').trim() || fallback;
  return base.replace(/\/+$/, '');
}
