import { loadEnv } from '../src/config/env';
import {
  UNIT_TEST_DATABASE_URL,
  ensureUnitTestDatabaseUrl,
} from './setup-env';

describe('unit test environment', () => {
  it('provides a parse-only DATABASE_URL when a clean environment has none', () => {
    const env: NodeJS.ProcessEnv = {};

    ensureUnitTestDatabaseUrl(env);

    expect(env.DATABASE_URL).toBe(UNIT_TEST_DATABASE_URL);
    expect(loadEnv(env).DATABASE_URL).toBe(UNIT_TEST_DATABASE_URL);
  });

  it('preserves an explicitly supplied database URL for integration callers', () => {
    const databaseUrl =
      'postgresql://integration:integration@127.0.0.1:5432/integration?schema=public';
    const env: NodeJS.ProcessEnv = { DATABASE_URL: databaseUrl };

    ensureUnitTestDatabaseUrl(env);

    expect(env.DATABASE_URL).toBe(databaseUrl);
  });
});
