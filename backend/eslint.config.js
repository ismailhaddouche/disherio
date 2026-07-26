// ESLint flat config for the backend (CommonJS package, so this file uses
// require()). Extends typescript-eslint's recommended set, which stays at
// 'error' and gates CI.
//
// Gate policy: rules the current codebase already satisfies remain 'error'.
// Rules with pre-existing violations (measured 2026-07-19) are demoted to
// 'warn' with a TODO so the gate passes today but keeps flagging them until
// the code is cleaned up; do NOT add new violations of rules set to 'error'.
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // TODO(debt): 40 pre-existing `any` violations on 2026-07-19 (mostly
      // query-profiler.ts, pagination.ts, rate-limiter.ts). Demote to 'off'
      // only after typing them; restore to 'error' once cleaned up.
      '@typescript-eslint/no-explicit-any': 'warn',
      // TODO(debt): 14 pre-existing unused vars on 2026-07-19 (including
      // intentionally-unused `_`-prefixed params). Consider enabling
      // argsIgnorePattern '^_' and restoring to 'error' once cleaned up.
      '@typescript-eslint/no-unused-vars': 'warn',
      // TODO(debt): 2 pre-existing namespace declarations on 2026-07-19.
      // Restore to 'error' once the namespaces are converted to modules.
      '@typescript-eslint/no-namespace': 'warn',
      // TODO(debt): 1 pre-existing violation on 2026-07-19
      // (calculation.utils.ts). Restore to 'error' once fixed.
      'prefer-const': 'warn',
    },
  }
);
