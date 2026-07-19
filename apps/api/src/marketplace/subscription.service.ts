import { Injectable } from '@nestjs/common';
import type { SubscriptionState } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toSubscriptionDto } from './marketplace.mapper';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<SubscriptionState> {
    const now = new Date();
    const active = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
    });
    if (active) {
      return { eligible: true, subscription: toSubscriptionDto(active) };
    }

    const latest = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      eligible: false,
      subscription: latest ? toSubscriptionDto(latest) : null,
    };
  }

  async isEligible(userId: string): Promise<boolean> {
    const now = new Date();
    const count = await this.prisma.subscription.count({
      where: {
        userId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
    });
    return count > 0;
  }
}
