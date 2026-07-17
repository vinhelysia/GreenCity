import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Env already loaded from monorepo-root .env in main.ts; avoid non-root files.
      ignoreEnvFile: true,
    }),
    PrismaModule,
    StorageModule,
    MailModule,
    HealthModule,
  ],
})
export class AppModule {}
