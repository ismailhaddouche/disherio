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
  // Thresholds set slightly below the coverage measured on 2026-07
  // (statements 45.82, branches 27.69, functions 39.28, lines 46.96)
  // so CI fails on regressions without breaking on noise.
  coverageThreshold: {
    global: {
      statements: 45,
      branches: 27,
      functions: 39,
      lines: 46,
    },
  },
};
