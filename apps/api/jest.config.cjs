/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  // Phase 0 specs are custom runners (tsx); keep them out of Jest.
  testPathIgnorePatterns: [
    '/node_modules/',
    'local-object-storage\\.spec\\.ts$',
    'paths\\.spec\\.ts$',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
