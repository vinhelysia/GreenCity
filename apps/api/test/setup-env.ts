import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Parse-only fallback for the unit lane. It deliberately points at an
 * unreachable local port: unit tests must mock Prisma or stay pure, while
 * integration tests provide a real DATABASE_URL and retain that value.
 */
export const UNIT_TEST_DATABASE_URL =
  'postgresql://unit:unit@127.0.0.1:1/unit?schema=public';

export function ensureUnitTestDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): void {
  env.DATABASE_URL ??= UNIT_TEST_DATABASE_URL;
}

const root = path.resolve(__dirname, '../../..');
const envPath = path.join(root, '.env');
if (existsSync(envPath)) {
  loadDotenv({ path: envPath, override: false });
}

/**
 * Settings the suite needs regardless of the machine it runs on.
 *
 * The distinction between the two halves matters. The first half is a
 * *default*: a developer may legitimately point the suite at another value.
 * The second half is *owned by the test lane* and is therefore assigned, not
 * defaulted — `??` reads whatever the developer's own `.env` holds, and that
 * file was loaded a few lines above, so both of these used to follow the
 * developer's machine instead of the suite:
 *
 * - `.env.example` ships `AUTH_LOGIN_RATE_LIMIT=10`, the production-shaped
 *   value. The suite registers and signs in dozens of accounts inside one
 *   minute, so the limiter answered 429 and every later assertion failed on a
 *   missing session cookie.
 * - `.env.example` ships `STORAGE_LOCAL_DIR=.local/storage`, so uploads written
 *   by tests landed in the directory the development server serves from
 *   instead of the disposable one.
 *
 * CI has no root `.env`, which is why it never saw either symptom.
 */
export function applyTestLaneEnv(env: NodeJS.ProcessEnv = process.env): void {
  env.NODE_ENV = env.NODE_ENV ?? 'test';
  env.CORS_ORIGINS =
    env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000';
  env.STORAGE_DRIVER = env.STORAGE_DRIVER ?? 'local';
  env.MAIL_DRIVER = env.MAIL_DRIVER ?? 'console';
  env.SESSION_COOKIE_NAME = env.SESSION_COOKIE_NAME ?? 'gc_session';

  env.AUTH_LOGIN_RATE_LIMIT = '100';
  env.STORAGE_LOCAL_DIR = '.local/storage-test';
}

applyTestLaneEnv();
