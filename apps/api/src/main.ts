import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { findRepoRoot, repoRootEnvPath } from './config/paths';

/**
 * Load only the monorepo-root .env (canonical).
 * Does not load parent directories outside the repo or apps/api/.env.
 */
function loadCanonicalEnv(): void {
  const repoRoot = findRepoRoot();
  const envPath = repoRootEnvPath(repoRoot);
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
  }
  // Explicitly do NOT load ../../.env from outside repo or cwd-relative non-root files.
}

async function bootstrap() {
  loadCanonicalEnv();
  // Invalid/missing DATABASE_URL fails startup clearly (readiness is separate).
  const env = loadEnv();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  const port = env.API_PORT ?? env.PORT ?? 3001;
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(
    `Storage=${env.STORAGE_DRIVER} Mail=${env.MAIL_DRIVER} (GET /health is readiness)`,
    'Bootstrap',
  );
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
