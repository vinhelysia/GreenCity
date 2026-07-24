import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { isIP } from 'node:net';
import { AuthenticatedGuard } from './authz/authenticated.guard';
import { OriginGuard } from './common/origin.guard';
import { loadEnv } from './config/env';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './auth/session.module';
import { AuthzModule } from './authz/authz.module';
import { HealthModule } from './health/health.module';
import { LocationModule } from './location/location.module';
import { MailModule } from './mail/mail.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { PointsModule } from './points/points.module';
import { StorageModule } from './storage/storage.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { StatsModule } from './stats/stats.module';

type TrackerRequest = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  ip?: string;
};

function rateLimitTracker(req: TrackerRequest): string {
  const socketIp = req.socket?.remoteAddress ?? req.ip ?? 'unknown';
  if (loadEnv().TRUST_PROXY !== 1) return socketIp;

  // Render places the real client address first. Ignore every later value:
  // clients can supply their own X-Forwarded-For suffix, so Express numeric
  // hop counting lets them choose a new rate-limit bucket. Invalid/missing
  // values fail closed to the proxy socket instead of becoming attacker keys.
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',', 1)[0]
    ?.trim();
  return first && isIP(first) ? first : socketIp;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Env already loaded from monorepo-root .env in main.ts; avoid non-root files.
      ignoreEnvFile: true,
    }),
    ThrottlerModule.forRoot([
      {
        // High default so non-login routes are not constrained; login overrides via @Throttle.
        name: 'default',
        ttl: 60_000,
        limit: 1000,
        getTracker: (req) => rateLimitTracker(req),
      },
    ]),
    PrismaModule,
    AuditModule,
    SessionModule,
    StorageModule,
    MailModule,
    HealthModule,
    AuthzModule,
    AuthModule,
    MediaModule,
    LocationModule,
    MarketplaceModule,
    CleanupModule,
    PointsModule,
    StatsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticatedGuard,
    },
  ],
})
export class AppModule {}
