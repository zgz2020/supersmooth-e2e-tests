import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'playwright-reports/**',
      'performance-reports/**',
      'ai-reports/**',
      'test-results/**',
      '.cache-synpress/**',
      'dist/**',
      '.env',
      '.temp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    ignores: ['tests/performance/**'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-focused-test': 'warn',
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
      'playwright/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',
            'expectStatusCode',
            'shouldBeOpened',
            'shouldBeVisible',
            'openPosition',
          ],
          assertFunctionPatterns: ['^.*\\.should.*', '^should.*'],
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-restricted-syntax': [
        'error',
        ...[
          'ImportDeclaration',
          'ExportAllDeclaration',
          'ExportNamedDeclaration',
          'ImportExpression',
        ].map((node) => ({
          selector: `${node} > Literal.source[value=/^\\.{1,2}\\/.*\\.(js|ts)$/]`,
          message: `Do not use file extensions ('.js' or '.ts') for relative imports.`,
        })),
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['tests/performance/**/*.ts', 'scripts/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  eslintPluginPrettierRecommended,
);
