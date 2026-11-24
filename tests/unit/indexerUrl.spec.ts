import { test, expect } from '@playwright/test';
import { indexerGraphqlUrl, indexerUrlVariable } from '../../utils/constants/urls';

/** Unit tests for indexerGraphqlUrl: the indexer is picked from the app's host (no network). */
const env = {
  INDEXER_URL_STAGING: 'https://indexer-staging.example/',
  INDEXER_URL_PRODUCTION: 'https://indexer.example',
};

test.describe('indexerGraphqlUrl', () => {
  test('uses the staging indexer for a staging app', () => {
    expect(indexerGraphqlUrl('https://staging.supersmooth.fi', env)).toBe(
      'https://indexer-staging.example/graphql',
    );
  });

  test('uses the production indexer for any other app', () => {
    expect(indexerGraphqlUrl('https://supersmooth.fi', env)).toBe(
      'https://indexer.example/graphql',
    );
  });

  test('INDEXER_URL overrides both', () => {
    expect(
      indexerGraphqlUrl('https://staging.supersmooth.fi', {
        ...env,
        INDEXER_URL: 'http://localhost:42069',
      }),
    ).toBe('http://localhost:42069/graphql');
  });

  test('names the missing variable, without any URL', () => {
    expect(() =>
      indexerGraphqlUrl('https://supersmooth.fi', { INDEXER_URL_STAGING: 'https://x.example' }),
    ).toThrow(/^INDEXER_URL_PRODUCTION is not set/);
  });
});

test.describe('indexerUrlVariable', () => {
  test('names the variable the URL is read from', () => {
    expect(indexerUrlVariable('https://staging.supersmooth.fi', env)).toBe('INDEXER_URL_STAGING');
    expect(indexerUrlVariable('https://supersmooth.fi', env)).toBe('INDEXER_URL_PRODUCTION');
    expect(indexerUrlVariable('https://supersmooth.fi', { ...env, INDEXER_URL: 'http://x' })).toBe(
      'INDEXER_URL',
    );
  });
});
