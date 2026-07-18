import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../authz/authenticated.guard';
import { HealthService } from './health.service';

/**
 * GET /health is a **readiness** probe (not liveness).
 * - 200 when database + PostGIS are up
 * - 503 when database and/or PostGIS are unreachable
 * Process stays up when DB is down so the probe can report 503.
 * Invalid env still fails process startup (see main.ts).
 */
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res({ passthrough: false }) res: Response): Promise<void> {
    const body = await this.healthService.check();
    const httpStatus = body.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(body);
  }
}
