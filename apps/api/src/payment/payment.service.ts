import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  CreateSubscriptionPaymentResponseSchema,
  SubscriptionPaymentStatusResponseSchema,
  type CreateSubscriptionPaymentResponse,
  type SubscriptionPaymentStatusResponse,
} from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { createPayosPayment } from './payos-client';
import {
  PAYOS_DESCRIPTION,
  PAYOS_ORDER_CODE_MAX,
  PAYOS_SUCCESS_CODE,
  resolvePayosCheckoutConfig,
} from './payos-config';

/**
 * The signed fields of a payOS webhook, after signature verification. Only what
 * the signature actually covers reaches this service — an unsigned field is a
 * caller-chosen field and must never influence whether access is granted.
 */
export interface VerifiedPaymentNotification {
  /** Decimal string, compared against the stored providerOrderId. */
  orderCode: string;
  amount: number;
  description: string;
  reference: string;
  paymentLinkId: string;
  code: string;
}

export interface ProcessNotificationResult {
  status: 'PAID' | 'PENDING' | 'IGNORED_MISMATCH' | 'DUPLICATE';
  paymentId?: string;
  subscriptionId?: string | null;
}

/**
 * payOS orderCode: a positive integer that must survive JSON round-tripping in
 * JavaScript. Milliseconds give ordering and three random digits give room for
 * concurrent checkouts inside the same millisecond; the unique index on
 * providerOrderId is what actually guarantees uniqueness, and startCheckout
 * retries when it fires. Nothing here derives from user input.
 */
function nextOrderCode(): number {
  const code = Date.now() * 1000 + randomInt(0, 1000);
  // Date.now() * 1000 is ~1.8e15 today and stays inside the safe range for
  // centuries, but an absurd system clock must not silently produce a value
  // that loses precision on the wire.
  if (!Number.isSafeInteger(code) || code <= 0 || code > PAYOS_ORDER_CODE_MAX) {
    throw new ServiceUnavailableException({
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      message: 'Payment provider is unavailable',
    });
  }
  return code;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Starts a checkout: the PENDING row is written before payOS is called and is
   * left PENDING however that call ends — no delete, no FAILED. A timeout is
   * ambiguous: payOS may have accepted the order and a valid webhook may still
   * arrive. Marking the row FAILED here would make processVerifiedNotification
   * treat that later webhook as a duplicate and silently drop paid access.
   */
  async startCheckout(
    userId: string,
    requestId?: string,
  ): Promise<CreateSubscriptionPaymentResponse> {
    const config = resolvePayosCheckoutConfig(loadEnv());
    if (!config) {
      // Which value is missing is never disclosed — see resolvePayosCheckoutConfig.
      throw new ServiceUnavailableException({
        code: 'PAYMENT_NOT_CONFIGURED',
        message: 'Payment checkout is not configured',
      });
    }

    const payment = await this.createPendingPayment(userId);

    await this.audit.record({
      actorId: userId,
      action: 'subscription_payment.create',
      targetType: 'SubscriptionPayment',
      targetId: payment.id,
      requestId,
      // Server-set plan only; nothing from the request, the provider, or a secret.
      metadata: {
        amountVnd: payment.amountVnd,
        durationDays: payment.durationDays,
      },
    });

    const created = await createPayosPayment(config, {
      // Narrowed to a number only here, at the protocol boundary. The column
      // stays text so it can also hold the historical MoMo identifiers.
      orderCode: Number(payment.providerOrderId),
      // Read back from the row, never from the request: the client cannot
      // influence what it is charged.
      amount: payment.amountVnd,
      description: payment.providerDescription ?? PAYOS_DESCRIPTION,
    });

    // Learned only now, and only when payOS answered. A create that times out
    // leaves this null, and a later signed webhook may claim it.
    await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { providerPaymentId: created.providerPaymentId },
    });

    return CreateSubscriptionPaymentResponseSchema.parse({
      paymentId: payment.id,
      payUrl: created.payUrl,
    });
  }

  /**
   * Owner-only. Ownership is part of the lookup, so another user's payment and
   * a nonexistent one produce the identical 404 — nothing distinguishes them.
   */
  async getPaymentStatus(
    userId: string,
    paymentId: string,
  ): Promise<SubscriptionPaymentStatusResponse> {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { id: paymentId, userId },
      select: { id: true, status: true, amountVnd: true, paidAt: true },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found',
      });
    }
    // The schema is the whitelist: no provider ids, result codes, or owner.
    return SubscriptionPaymentStatusResponseSchema.parse({
      ...payment,
      paidAt: payment.paidAt?.toISOString() ?? null,
    });
  }

  /**
   * Retries only the orderCode collision, which the unique index turns into a
   * P2002. Two checkouts inside the same millisecond drawing the same three
   * random digits is the only way to reach it.
   */
  async createPendingPayment(userId: string, attempts = 5) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.subscriptionPayment.create({
          data: {
            userId,
            amountVnd: 50000,
            durationDays: 30,
            status: 'PENDING',
            provider: 'PAYOS',
            providerOrderId: String(nextOrderCode()),
            providerDescription: PAYOS_DESCRIPTION,
          },
        });
      } catch (error) {
        const collision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!collision || attempt >= attempts) throw error;
      }
    }
  }

  async processVerifiedNotification(
    notification: VerifiedPaymentNotification,
  ): Promise<ProcessNotificationResult> {
    try {
      return await this.claimAndActivate(notification);
    } catch (error) {
      // A bank reference, or a payment link, already recorded against another
      // row trips a unique index. That is the guard working, not a fault: the
      // webhook is acknowledged and nothing is granted.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Payment notification ignored: orderCode=${notification.orderCode} provider identifier already used`,
        );
        return { status: 'IGNORED_MISMATCH' };
      }
      throw error;
    }
  }

  private async claimAndActivate(
    notification: VerifiedPaymentNotification,
  ): Promise<ProcessNotificationResult> {
    return this.executeWithRetry(async () => {
      return this.prisma.$transaction(
        async (tx) => {
          const payment = await tx.subscriptionPayment.findUnique({
            where: { providerOrderId: notification.orderCode },
          });

          if (!payment) {
            this.logger.warn(
              `Payment notification ignored: orderCode=${notification.orderCode} not found`,
            );
            return { status: 'IGNORED_MISMATCH' };
          }

          // These signed fields prove the callback answers our order. payOS
          // prefixes description per channel, so it is not a stable identifier.
          const mismatched =
            payment.amountVnd !== notification.amount ||
            // Null means the create call never came back with an id. A signed
            // webhook is then allowed to claim it — refusing would punish a
            // payer for our timeout. Once known, it must match exactly.
            (payment.providerPaymentId !== null &&
              payment.providerPaymentId !== notification.paymentLinkId);

          if (mismatched) {
            this.logger.warn(
              `Payment notification ignored: orderCode=${notification.orderCode} immutable fields mismatch`,
            );
            return { status: 'IGNORED_MISMATCH' };
          }

          if (payment.status !== 'PENDING') {
            this.logger.log(
              `Payment notification duplicate for orderCode=${notification.orderCode}, current status=${payment.status}`,
            );
            return {
              status: 'DUPLICATE',
              paymentId: payment.id,
              subscriptionId: payment.subscriptionId,
            };
          }

          if (notification.code !== PAYOS_SUCCESS_CODE) {
            // payOS documents no terminal-failure webhook for the payment-link
            // flow, so a non-success code is recorded and the row stays
            // claimable. Resolving it here would discard a success that
            // arrives afterwards. No transaction id is stored: that column is
            // unique, and a placeholder would collide with the next callback.
            await tx.subscriptionPayment.updateMany({
              where: { id: payment.id, status: 'PENDING' },
              data: { providerResultCode: notification.code },
            });
            return { status: 'PENDING', paymentId: payment.id };
          }

          const claimCount = await tx.subscriptionPayment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: {
              status: 'PAID',
              // Unique: one bank transfer cannot activate two subscriptions.
              providerTransactionId: notification.reference,
              providerResultCode: notification.code,
              providerPaymentId: notification.paymentLinkId,
            },
          });

          if (claimCount.count === 0) {
            const rechecked = await tx.subscriptionPayment.findUnique({
              where: { id: payment.id },
            });
            return {
              status: 'DUPLICATE',
              paymentId: payment.id,
              subscriptionId: rechecked?.subscriptionId ?? null,
            };
          }

          const now = new Date();
          const latestActive = await tx.subscription.findFirst({
            where: {
              userId: payment.userId,
              status: 'ACTIVE',
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: 'desc' },
          });

          let startsAt = now;
          if (latestActive && latestActive.expiresAt > now) {
            startsAt = latestActive.expiresAt;
          }
          const expiresAt = new Date(
            startsAt.getTime() + payment.durationDays * 24 * 60 * 60 * 1000,
          );

          const subscription = await tx.subscription.create({
            data: {
              userId: payment.userId,
              status: 'ACTIVE',
              startsAt,
              expiresAt,
            },
          });

          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              paidAt: now,
              subscriptionId: subscription.id,
            },
          });

          return {
            status: 'PAID',
            paymentId: payment.id,
            subscriptionId: subscription.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 5,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        return await fn();
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt < maxAttempts) {
          this.logger.warn(
            `Prisma serializable transaction conflict (P2034), retrying attempt ${attempt}/${maxAttempts}...`,
          );
          await new Promise((res) => setTimeout(res, 25 * attempt));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Transaction execution failed after maximum attempts');
  }
}
