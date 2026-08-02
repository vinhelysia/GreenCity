import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PointsBalance, RewardOfferList } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

// Tunable reward rates; adjust these values when the points policy changes.
const POINTS_RULES = {
  LISTING_COMPLETED: (
    estimatedWeightKg: number,
    sellerPricePerKgVnd: number,
  ) =>
    Math.max(
      1,
      Math.floor((estimatedWeightKg * sellerPricePerKgVnd) / 1000),
    ),
  CLEANUP_VERIFIED: 50,
} as const;

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  awardListingCompleted(
    tx: Prisma.TransactionClient,
    listing: {
      id: string;
      sellerId: string;
      estimatedWeightKg: number;
      sellerPricePerKgVnd: number;
    },
  ) {
    return tx.pointEntry.create({
      data: {
        userId: listing.sellerId,
        delta: POINTS_RULES.LISTING_COMPLETED(
          listing.estimatedWeightKg,
          listing.sellerPricePerKgVnd,
        ),
        reason: 'LISTING_COMPLETED',
        referenceId: listing.id,
      },
    });
  }

  awardCleanupVerified(
    tx: Prisma.TransactionClient,
    report: { id: string; reporterId: string },
  ) {
    return tx.pointEntry.create({
      data: {
        userId: report.reporterId,
        delta: POINTS_RULES.CLEANUP_VERIFIED,
        reason: 'CLEANUP_VERIFIED',
        referenceId: report.id,
      },
    });
  }

  async getBalance(userId: string): Promise<PointsBalance> {
    const [balance, entries] = await Promise.all([
      this.prisma.pointEntry.aggregate({
        where: { userId },
        _sum: { delta: true },
      }),
      this.prisma.pointEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          delta: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      balance: balance._sum.delta ?? 0,
      entries: entries.map(({ createdAt, ...entry }) => ({
        ...entry,
        occurredAt: createdAt.toISOString(),
      })),
    };
  }

  async listOffers(): Promise<RewardOfferList> {
    // demoOnly: true in the where-clause (not only the column default) makes
    // "demo-only" a property of this endpoint, not merely of today's data —
    // the query still reads right even if some future row is ever not one.
    const offers = await this.prisma.rewardOffer.findMany({
      where: { isActive: true, demoOnly: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        slug: true,
        merchantName: true,
        offerVi: true,
        offerEn: true,
        pointsCost: true,
        demoOnly: true,
      },
    });
    return { offers: offers.map((o) => ({ ...o, demoOnly: true as const })) };
  }
}
