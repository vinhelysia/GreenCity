import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GrantSubscriptionRequest,
  GrantSubscriptionResponse,
  SubscriptionState,
} from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../authz/auth-context';
import { normalizeEmail } from '../auth/auth.mapper';
import { loadEnv } from '../config/env';
import { resolvePayosCheckoutConfig } from '../payment/payos-config';
import { PrismaService } from '../prisma/prisma.service';
import { toSubscriptionDto } from './marketplace.mapper';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async me(userId: string): Promise<SubscriptionState> {
    // Whether a checkout could run at all. One boolean on purpose: the caller
    // must not be able to infer which credential is absent, and read fresh so
    // configuring payOS does not require a restart to show up here.
    const checkoutAvailable = resolvePayosCheckoutConfig(loadEnv()) !== null;
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

  /**
   * Hands someone a buyer pass with no payment behind it. payOS is otherwise
   * the only route to eligibility and it has never run against a real merchant
   * account, so without this the pass cannot be obtained at all.
   *
   * Deliberately not a payment: no SubscriptionPayment row is created and
   * nothing here reports money as received. The grant is an eligibility record
   * with a required reason, written to the audit log against the admin who
   * issued it — free access to a paid feature has to be attributable.
   */
  async grantByAdmin(
    auth: AuthContext,
    input: GrantSubscriptionRequest,
    requestId?: string,
  ): Promise<GrantSubscriptionResponse> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'No account with that email',
      });
    }

    // Overlapping rows are harmless to the eligibility query, but a second
    // grant is far more often a slip than an intent, and the admin cannot see
    // existing passes from the form. Refuse and say when the current one ends.
    const now = new Date();
    const active = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
    });
    if (active) {
      throw new ConflictException({
        code: 'SUBSCRIPTION_ALREADY_ACTIVE',
        message: `Account already has a pass until ${active.expiresAt.toISOString()}`,
      });
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt: new Date(now.getTime() + input.durationDays * DAY_MS),
        note: input.note,
      },
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'subscription.grant',
      targetType: 'Subscription',
      targetId: subscription.id,
      requestId,
      metadata: {
        grantedToUserId: user.id,
        durationDays: input.durationDays,
        note: input.note,
      },
    });

    return { subscription: toSubscriptionDto(subscription), userEmail: user.email };
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
