const base = require('./jest.config.cjs');

/**
 * Database-backed lane — requires a live PostgreSQL with the PostGIS extension
 * and all Prisma migrations applied. The suite boots the real AppModule, so a
 * placeholder DATABASE_URL will fail loudly instead of passing.
 *
 * Defined by inclusion: this lane is exactly the suites that need a database.
 */
module.exports = {
  ...base,
  testMatch: [
    '<rootDir>/test/phase1.integration.test.ts',
    '<rootDir>/test/marketplace.integration.test.ts',
    '<rootDir>/test/cleanup.integration.test.ts',
  ],
};
