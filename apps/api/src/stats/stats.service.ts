import { Injectable } from '@nestjs/common';
import type { HomeStats } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getHomeStats(): Promise<HomeStats> {
    const [availableListings, verifiedCleanupReports, weight, points] =
      await Promise.all([
        this.prisma.marketplaceListing.count({ where: { status: 'AVAILABLE' } }),
        this.prisma.cleanupReport.count({ where: { status: 'VERIFIED' } }),
        this.prisma.marketplaceListing.aggregate({ _sum: { estimatedWeightKg: true } }),
        // Awards only: a future redemption writes negative deltas, and those
        // must not subtract from "points ever granted".
        this.prisma.pointEntry.aggregate({
          where: { delta: { gt: 0 } },
          _sum: { delta: true },
        }),
      ]);
    return {
      availableListings,
      verifiedCleanupReports,
      scrapWeightKg: weight._sum.estimatedWeightKg ?? 0,
      totalPointsAwarded: points._sum.delta ?? 0,
    };
  }
}
