import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // DATABASE_URL and other secrets come from process env / local .env
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
