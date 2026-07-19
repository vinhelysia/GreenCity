const base = require('./jest.config.cjs');

/**
 * Unit / config / security lane — never opens a database connection.
 *
 * Everything in this lane either mocks Prisma or is pure logic. It still needs
 * DATABASE_URL to be *present and parseable*, because src/config/env.ts validates
 * the whole environment when a guard or service reads it (see audit-regression's
 * OriginGuard case). Parsing is not connecting: a placeholder value is honest here.
 *
 * Defined by exclusion, so a newly added test lands in this lane by default rather
 * than silently running in neither.
 */
module.exports = {
  ...base,
  testPathIgnorePatterns: [
    ...base.testPathIgnorePatterns,
    // Any *.integration.test.ts belongs to the database-backed lane, not here.
    '\\.integration\\.test\\.ts$',
  ],
};
