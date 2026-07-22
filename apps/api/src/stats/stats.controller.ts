import { Controller, Get } from '@nestjs/common';
import type { HomeStats } from '@greencity/shared';
import { Public } from '../authz/authenticated.guard';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Get()
  async getHomeStats(): Promise<HomeStats> {
    return this.statsService.getHomeStats();
  }
}
