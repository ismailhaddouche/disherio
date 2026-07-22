/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/**/*.d.ts',
    '!src/seeders/**',
  ],
  // Floors are set just below the full src/** baseline (including files that
  // no test imports) so both local and integration-backed CI runs detect
  // regressions consistently.
  coverageThreshold: {
    global: {
      statements: 39,
      branches: 25,
      functions: 36,
      lines: 40,
    },
  },
};
