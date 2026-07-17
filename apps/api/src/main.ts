import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

// Root monorepo .env and apps/api/.env (no Docker; native Postgres)
loadDotenv({ path: path.resolve(process.cwd(), '.env') });
loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });

async function assertPostgresReachable(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        'PostgreSQL is unavailable. Local development requires a running native PostgreSQL instance.',
        '  1) Install PostgreSQL 16+ for Windows (no Docker required)',
        '  2) pnpm db:setup',
        '  3) Install PostGIS for your PG version, then pnpm db:postgis',
        '  4) pnpm db:migrate',
        '  5) pnpm db:verify',
        `Underlying error: ${detail}`,
      ].join('\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  const env = loadEnv();
  await assertPostgresReachable(env.DATABASE_URL);

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  const port = env.API_PORT ?? env.PORT ?? 3001;
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(
    `Storage=${env.STORAGE_DRIVER} Mail=${env.MAIL_DRIVER}`,
    'Bootstrap',
  );
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
