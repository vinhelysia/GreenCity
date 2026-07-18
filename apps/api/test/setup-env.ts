import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const envPath = path.join(root, '.env');
if (existsSync(envPath)) {
  loadDotenv({ path: envPath, override: false });
}

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000';
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'local';
process.env.STORAGE_LOCAL_DIR =
  process.env.STORAGE_LOCAL_DIR ?? '.local/storage-test';
process.env.MAIL_DRIVER = process.env.MAIL_DRIVER ?? 'console';
process.env.SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'gc_session';
process.env.AUTH_LOGIN_RATE_LIMIT =
  process.env.AUTH_LOGIN_RATE_LIMIT ?? '100';
