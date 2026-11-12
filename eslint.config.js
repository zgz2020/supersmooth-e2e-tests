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
    // Plain Node ES modules need explicit .js extensions in relative imports
    files: ['tests/performance/**/*.ts', 'scripts/**/*.js', 'tests/unit/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Type-aware promise checks for all TypeScript (page objects, helpers, specs, config) to stop
    // silent false passes, where an assertion or action never runs and the test passes anyway:
    // - no-floating-promises: `expect(locator).toHaveText(...)`, `locator.click()` or an async
    //   page-object method called without `await`
    // - no-misused-promises: `items.forEach(async ...)` (never awaited) and promises used as
    //   conditions, e.g. `if (locator.isVisible())` without `await` (always truthy)
    // - await-thenable: `await` on a non-promise, which misleads about what actually waits
    files: ['**/*.ts'],
    ignores: ['tests/performance/**'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  eslintPluginPrettierRecommended,
);
