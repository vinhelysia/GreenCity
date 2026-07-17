import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const database = await this.pingDatabase();

    return {
      status: database === 'up' ? 'ok' : 'error',
      service: 'api',
      timestamp: new Date().toISOString(),
      checks: { database },
    };
  }

  private async pingDatabase(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
