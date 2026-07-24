import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface VerifiedPaymentNotification {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  transId: string;
  resultCode: number;
  message?: string;
}

export interface ProcessNotificationResult {
  status: 'PAID' | 'FAILED' | 'IGNORED_MISMATCH' | 'DUPLICATE';
  paymentId?: string;
  subscriptionId?: string | null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {}

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

          const claimCount = await tx.subscriptionPayment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: {
              status: notification.resultCode === 0 ? 'PAID' : 'FAILED',
              momoTransactionId:
                notification.resultCode === 0 ? notification.transId : null,
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

          if (notification.resultCode !== 0) {
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
              note: `Purchased via MoMo payment ${payment.id} (orderId: ${payment.momoOrderId})`,
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
