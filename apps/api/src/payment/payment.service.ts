import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
import { createMomoPayment } from './momo-client';
import {
  MOMO_EXTRA_DATA,
  MOMO_ORDER_INFO,
  resolveMomoCheckoutConfig,
} from './momo-config';

export interface VerifiedPaymentNotification {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  transId: string;
  resultCode: number;
  message?: string;
}

/**
 * What a MoMo resultCode means for the payment row.
 *
 * `0` is a completed payment. `9000` is an authorised one, which is the same
 * thing here only because checkout sends autoCapture: true — on a two-step
 * flow it would still need capturing, so the two must be read together.
 *
 * The in-flight codes are the reason this is not a boolean: MoMo sends a
 * callback while the payer is still deciding, and treating that as failure
 * would resolve the row before the real answer arrives, after which the
 * genuine success IPN is discarded as a duplicate and paid access is lost.
 */
const PAID_RESULT_CODES = new Set([0, 9000]);

/**
 * The codes MoMo's result table marks final for a one-time wallet payment.
 *
 * Membership is explicit and the default below is PENDING, never FAILED,
 * because FAILED is irreversible here: it takes the row out of the claimable
 * state, so a success callback arriving afterwards is discarded as a duplicate
 * and someone who paid silently loses access. Plenty of codes are documented
 * final-status "no" — 10, 11, 20, 40, 43 and 47 among them — and resolving an
 * unrecognised one as failure would bet a paid subscription on this list being
 * exhaustive.
 *
 * Refund and disbursement codes (1080, 1081, 1088) are deliberately absent:
 * they belong to flows this service does not run, and a payment IPN never
 * carries them.
 */
const TERMINAL_FAILURE_RESULT_CODES = new Set([
  98,
  99,
  1001, // insufficient funds
  1002, // rejected by the issuer
  1003, // cancelled after authorisation
  1004, // amount exceeds the payer's limit
  1005, // payment url / QR expired
  1006, // payer denied the confirmation
  1007,
  1017,
  1026,
  4001,
  4002,
  4100,
]);

function classifyResultCode(code: number): 'PAID' | 'PENDING' | 'FAILED' {
  if (PAID_RESULT_CODES.has(code)) return 'PAID';
  if (TERMINAL_FAILURE_RESULT_CODES.has(code)) return 'FAILED';
  // Everything else — in-flight (1000, 7000, 7002), non-final, or simply
  // unknown to us — stays open. Fail closed: no access, but still claimable.
  return 'PENDING';
}

export interface ProcessNotificationResult {
  status: 'PAID' | 'PENDING' | 'FAILED' | 'IGNORED_MISMATCH' | 'DUPLICATE';
  paymentId?: string;
  subscriptionId?: string | null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Starts a checkout: the PENDING row is written before MoMo is called and is
   * left PENDING however that call ends — no delete, no FAILED. A timeout is
   * ambiguous: MoMo may have accepted the order and a valid IPN may still
   * arrive. Marking the row FAILED here would make processVerifiedNotification
   * treat that later IPN as a duplicate and silently drop paid access.
   */
  async startCheckout(
    userId: string,
    requestId?: string,
  ): Promise<CreateSubscriptionPaymentResponse> {
    const config = resolveMomoCheckoutConfig(loadEnv());
    if (!config) {
      // Which value is missing is never disclosed — see resolveMomoCheckoutConfig.
      throw new ServiceUnavailableException({
        code: 'PAYMENT_NOT_CONFIGURED',
        message: 'Payment checkout is not configured',
      });
    }

    const payment = await this.createPendingPayment({
      userId,
      // Server-generated and PII-free: MoMo echoes both back on the IPN, and a
      // UUID already satisfies its orderId charset (<=200) / requestId (<=50).
      momoOrderId: randomUUID(),
      momoRequestId: randomUUID(),
    });

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

    const created = await createMomoPayment(config, {
      orderId: payment.momoOrderId,
      requestId: payment.momoRequestId,
      // Read back from the row, never from the request: the client cannot
      // influence what it is charged.
      amount: payment.amountVnd,
      // Shared with the webhook, which compares the echoed values against these.
      orderInfo: MOMO_ORDER_INFO,
      extraData: MOMO_EXTRA_DATA,
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

  async createPendingPayment(input: {
    userId: string;
    momoOrderId: string;
    momoRequestId: string;
  }) {
    return this.prisma.subscriptionPayment.create({
      data: {
        userId: input.userId,
        amountVnd: 50000,
        durationDays: 30,
        status: 'PENDING',
        momoOrderId: input.momoOrderId,
        momoRequestId: input.momoRequestId,
      },
    });
  }

  async processVerifiedNotification(
    notification: VerifiedPaymentNotification,
  ): Promise<ProcessNotificationResult> {
    return this.executeWithRetry(async () => {
      return this.prisma.$transaction(
        async (tx) => {
          const payment = await tx.subscriptionPayment.findUnique({
            where: { momoOrderId: notification.orderId },
            include: { subscription: true },
          });

          if (!payment) {
            this.logger.warn(
              `Payment notification ignored: orderId=${notification.orderId} not found`,
            );
            return { status: 'IGNORED_MISMATCH' };
          }

          if (
            payment.momoRequestId !== notification.requestId ||
            payment.amountVnd !== notification.amount
          ) {
            this.logger.warn(
              `Payment notification ignored: orderId=${notification.orderId} immutable fields mismatch`,
            );
            return { status: 'IGNORED_MISMATCH' };
          }

          if (payment.status !== 'PENDING') {
            this.logger.log(
              `Payment notification duplicate for orderId=${notification.orderId}, current status=${payment.status}`,
            );
            return {
              status: 'DUPLICATE',
              paymentId: payment.id,
              subscriptionId: payment.subscriptionId,
            };
          }

          const outcome = classifyResultCode(notification.resultCode);

          if (outcome === 'PENDING') {
            // The payer has not finished. Record the code but leave the row
            // claimable, so the success IPN that follows can still take it.
            // No transaction id is stored: that column is unique, and a
            // placeholder would collide with the next in-flight callback.
            await tx.subscriptionPayment.updateMany({
              where: { id: payment.id, status: 'PENDING' },
              data: { momoResultCode: notification.resultCode },
            });
            return { status: 'PENDING', paymentId: payment.id };
          }

          const claimCount = await tx.subscriptionPayment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: {
              status: outcome,
              momoTransactionId:
                outcome === 'PAID' ? notification.transId : null,
              momoResultCode: notification.resultCode,
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

          if (outcome !== 'PAID') {
            return { status: 'FAILED', paymentId: payment.id };
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
