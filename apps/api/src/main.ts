import { ForbiddenException, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http-exception.filter';
import { requestIdMiddleware } from './common/request-id';
import { loadEnv } from './config/env';
import { findRuntimeRoot, repoRootEnvPath } from './config/paths';

/**
 * Load only the runtime-root .env (repository root in development, artifact root in production).
 * Does not load parent directories or a cwd-relative .env.
 */
function loadCanonicalEnv(): void {
  const repoRoot = findRuntimeRoot();
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

  // Behind Render's proxy, req.ip is the proxy unless Express is told how many
  // hops to trust. A specific hop count (never `true`) so X-Forwarded-For can't
  // be spoofed past the trusted proxies. 0 locally = trust nothing.
  app.getHttpAdapter().getInstance().set('trust proxy', env.TRUST_PROXY);

  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser tools (no Origin) and configured frontends.
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(
        new ForbiddenException({
          code: 'INVALID_ORIGIN',
          message: 'Origin is not allowed',
        }),
        false,
      );
    },
    credentials: true,
  });

  // PORT wins so a host that injects it (Render, Heroku) is honoured; API_PORT
  // has a default, so it must come second or PORT would never be used. Local
  // dev leaves PORT unset and gets API_PORT (3001).
  const port = env.PORT ?? env.API_PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  Logger.log(`API listening on 0.0.0.0:${port}`, 'Bootstrap');
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
