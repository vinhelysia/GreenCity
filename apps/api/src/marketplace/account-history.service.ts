import { Injectable } from '@nestjs/common';
import {
  AccountHistorySchema,
  type AccountHistory,
} from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Small account-only read model for data that has no existing owner list.
 * Profile, points, sell requests, cleanup reports, and current pass deliberately
 * stay on their established endpoints instead of growing this into a dashboard
 * mega endpoint.
 */
@Injectable()
export class AccountHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecent(userId: string, limit: number): Promise<AccountHistory> {
    const [reservations, subscriptions, payments] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { buyerId: userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          createdAt: true,
          listing: {
            select: {
              categoryName: true,
              estimatedWeightKg: true,
              buyerPricePerKgVnd: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.subscription.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          status: true,
          startsAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.subscriptionPayment.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          provider: true,
          status: true,
          amountVnd: true,
          createdAt: true,
          paidAt: true,
        },
      }),
    ]);

    // The shared schema is a final safe-output gate. The selects above are
    // intentionally narrow too, so provider checkout URLs/IDs never enter this
    // service's process data in the first place.
    return AccountHistorySchema.parse({
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        categoryName: reservation.listing.categoryName,
        estimatedWeightKg: reservation.listing.estimatedWeightKg,
        buyerPricePerKgVnd: reservation.listing.buyerPricePerKgVnd,
        estimatedTotalVnd: Math.round(
          reservation.listing.buyerPricePerKgVnd *
            reservation.listing.estimatedWeightKg,
        ),
        status: reservation.listing.status,
        createdAt: reservation.createdAt.toISOString(),
      })),
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        startsAt: subscription.startsAt.toISOString(),
        expiresAt: subscription.expiresAt.toISOString(),
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amountVnd: payment.amountVnd,
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt?.toISOString() ?? null,
      })),
    });
  }
}
