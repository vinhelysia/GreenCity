import { loadEnv } from '../src/config/env';
import {
  UNIT_TEST_DATABASE_URL,
  applyTestLaneEnv,
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

  /**
   * A root `.env` is loaded before these are applied, so the values it carries
   * arrive here already set. Defaulting with `??` therefore let a developer's
   * own file win: the production-shaped login limit throttled the suite into
   * 429s, and test uploads were written to the development storage directory.
   */
  it('overrides the two settings the test lane owns, even when a root .env set them', () => {
    const env: NodeJS.ProcessEnv = {
      AUTH_LOGIN_RATE_LIMIT: '10',
      STORAGE_LOCAL_DIR: '.local/storage',
    };

    applyTestLaneEnv(env);

    expect(env.AUTH_LOGIN_RATE_LIMIT).toBe('100');
    expect(env.STORAGE_LOCAL_DIR).toBe('.local/storage-test');
  });

  it('still lets a developer redirect the settings that are only defaults', () => {
    const env: NodeJS.ProcessEnv = {
      CORS_ORIGINS: 'http://localhost:4000',
      MAIL_DRIVER: 'file',
    };

    applyTestLaneEnv(env);

    expect(env.CORS_ORIGINS).toBe('http://localhost:4000');
    expect(env.MAIL_DRIVER).toBe('file');
  });
});
