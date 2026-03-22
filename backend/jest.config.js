export default {
    testEnvironment: 'node',
    transform: {},
    extensionsToTreatAsEsm: [],
    testMatch: ['**/src/__tests__/**/*.test.js'],
    testTimeout: 15000,
    // Force Node to use ESM with --experimental-vm-modules
    // Run with: NODE_OPTIONS='--experimental-vm-modules' npx jest
};
