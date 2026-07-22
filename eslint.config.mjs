import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'frontend/.angular/**',
    ],
  },
  {
    files: ['backend/src/**/*.ts', 'shared/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['frontend/src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['frontend/src/**/*.html'],
    extends: [...angular.configs.templateRecommended],
  },
  {
    files: ['backend/src/__tests__/**/*.ts', 'frontend/src/**/*.spec.ts'],
    rules: {
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
