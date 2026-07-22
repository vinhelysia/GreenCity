import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthenticatedGuard } from './authz/authenticated.guard';
import { OriginGuard } from './common/origin.guard';
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
import { StorageModule } from './storage/storage.module';
import { CleanupModule } from './cleanup/cleanup.module';

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
