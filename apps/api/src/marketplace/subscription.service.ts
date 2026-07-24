import { Injectable } from '@nestjs/common';
import type { SubscriptionState } from '@greencity/shared';
import { loadEnv } from '../config/env';
import { resolveMomoCheckoutConfig } from '../payment/momo-config';
import { PrismaService } from '../prisma/prisma.service';
import { toSubscriptionDto } from './marketplace.mapper';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<SubscriptionState> {
    // Whether a checkout could run at all. One boolean on purpose: the caller
    // must not be able to infer which credential is absent, and read fresh so
    // configuring MoMo does not require a restart to show up here.
    const checkoutAvailable = resolveMomoCheckoutConfig(loadEnv()) !== null;
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
      return {
        eligible: true,
        subscription: toSubscriptionDto(active),
        checkoutAvailable,
      };
    }

    const latest = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      eligible: false,
      subscription: latest ? toSubscriptionDto(latest) : null,
      checkoutAvailable,
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
