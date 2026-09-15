import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'dist/**', '.env'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',
            'expectStatusCode',
            'shouldBeOpened',
            '*.shouldBeOpened',
            'multiply.shouldBeOpened',
          ],
        },
      ],
    },
  },
  {
    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
