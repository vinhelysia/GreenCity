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
      this.logger.warn(
        `database readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'down';
    }
  }

  private async pingPostgis(): Promise<'up' | 'down'> {
    try {
      // Check the catalog rather than calling postgis_version() unqualified.
      // Managed Postgres (e.g. Supabase) installs PostGIS in the "extensions"
      // schema, which is not on the app role's search_path, so an unqualified
      // call fails with SQLSTATE 42883 even though the extension IS installed.
      const rows = await this.prisma.$queryRaw<Array<{ extversion: string }>>`
        SELECT extversion FROM pg_extension WHERE extname = 'postgis'
      `;
      if (rows.length > 0) {
        return 'up';
      }
      this.logger.warn('PostGIS readiness check: extension not installed');
      return 'down';
    } catch (err) {
      this.logger.warn(
        `PostGIS readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'down';
    }
  }
}
