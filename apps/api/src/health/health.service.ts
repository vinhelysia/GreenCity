import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const database = await this.pingDatabase();
    const postgis = database === 'up' ? await this.pingPostgis() : 'down';

    const status =
      database === 'up' && postgis === 'up'
        ? 'ok'
        : database === 'up'
          ? 'degraded'
          : 'error';

    return {
      status,
      service: 'api',
      timestamp: new Date().toISOString(),
      checks: { database, postgis },
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

  private async pingPostgis(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT PostGIS_Version()`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
