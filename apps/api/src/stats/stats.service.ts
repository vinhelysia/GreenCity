import { Injectable } from '@nestjs/common';
import type { HomeStats } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getHomeStats(): Promise<HomeStats> {
    const [availableListings, verifiedCleanupReports, weight] = await Promise.all([
      this.prisma.marketplaceListing.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.cleanupReport.count({ where: { status: 'VERIFIED' } }),
      this.prisma.marketplaceListing.aggregate({ _sum: { estimatedWeightKg: true } }),
    ]);
    return {
      availableListings,
      verifiedCleanupReports,
      scrapWeightKg: weight._sum.estimatedWeightKg ?? 0,
    };
  }
}
