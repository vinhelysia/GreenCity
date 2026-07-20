import { Injectable, Logger } from '@nestjs/common';
import type { HealthStatus } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Readiness check: DB + PostGIS must both be up for status "ok".
   * Otherwise status is "error" (HTTP 503 via controller).
   */
  async check(): Promise<HealthStatus> {
    const database = await this.pingDatabase();
    const postgis = database === 'up' ? await this.pingPostgis() : 'down';

    // Readiness: both required for "ok". Partial PostGIS failure is also not ready.
    const status: HealthStatus['status'] =
      database === 'up' && postgis === 'up' ? 'ok' : 'error';

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
    } catch (err) {
      // TEMP diagnostic: surface the real DB error in logs (revert after diagnosis).
      this.logger.error(
        `healthcheck database ping failed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      );
      return 'down';
    }
  }

  private async pingPostgis(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT PostGIS_Version()`;
      return 'up';
    } catch (err) {
      // TEMP diagnostic: surface the real PostGIS error in logs (revert after diagnosis).
      this.logger.error(
        `healthcheck postgis ping failed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      );
      return 'down';
    }
  }
}
