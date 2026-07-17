import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // Soft connect: health endpoint reports DB status if this fails at boot
    try {
      await this.$connect();
    } catch {
      // Leave disconnected; /health will show database: "down"
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
