import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentService } from '../src/payment/payment.service';
import './setup-env';

describe('Payment activation domain integration', () => {
  let prisma: PrismaService;
  let paymentService: PaymentService;
  let testUserId: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [PaymentService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    paymentService = moduleRef.get(PaymentService);

    const testUser = await prisma.user.create({
      data: {
        email: `buyer-${suffix}@payment-test.com`,
        displayName: 'Payment Test Buyer',
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    if (prisma && testUserId) {
      await prisma.subscriptionPayment
        .deleteMany({ where: { userId: testUserId } })
        .catch(() => undefined);
      await prisma.subscription
        .deleteMany({ where: { userId: testUserId } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: testUserId } })
        .catch(() => undefined);
    }
  });

  it('activates a pending payment into exactly one 30-day active subscription', async () => {
    const orderId = `momo-order-1-${suffix}`;
    const requestId = `momo-req-1-${suffix}`;

    const payment = await paymentService.createPendingPayment({
      userId: testUserId,
      momoOrderId: orderId,
      momoRequestId: requestId,
    });

    expect(payment.status).toBe('PENDING');

    const result = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId,
      amount: 50000,
      transId: 'trans-1001',
      resultCode: 0,
    });

    expect(result.status).toBe('PAID');
    expect(result.paymentId).toBe(payment.id);
    expect(result.subscriptionId).toBeTruthy();

    const updatedPayment = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
      include: { subscription: true },
    });
    expect(updatedPayment?.status).toBe('PAID');
    expect(updatedPayment?.momoTransactionId).toBe('trans-1001');
    expect(updatedPayment?.subscription).toBeTruthy();
    expect(updatedPayment?.subscription?.status).toBe('ACTIVE');

    const subCount = await prisma.subscription.count({
      where: { userId: testUserId },
    });
    expect(subCount).toBe(1);
  });

  it('handles duplicate successful notifications idempotently without adding extra time', async () => {
    const orderId = `momo-order-dup-${suffix}`;
    const requestId = `momo-req-dup-${suffix}`;

    await paymentService.createPendingPayment({
      userId: testUserId,
      momoOrderId: orderId,
      momoRequestId: requestId,
    });

    const firstResult = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId,
      amount: 50000,
      transId: 'trans-dup-1',
      resultCode: 0,
    });
    expect(firstResult.status).toBe('PAID');

    const secondResult = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId,
      amount: 50000,
      transId: 'trans-dup-1',
      resultCode: 0,
    });

    expect(secondResult.status).toBe('DUPLICATE');
    expect(secondResult.paymentId).toBe(firstResult.paymentId);
    expect(secondResult.subscriptionId).toBe(firstResult.subscriptionId);

    const subCountForOrder = await prisma.subscriptionPayment.count({
      where: { momoOrderId: orderId, status: 'PAID' },
    });
    expect(subCountForOrder).toBe(1);
  });

  it('ignores notifications with an unknown orderId', async () => {
    const unknownResult = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId: `nonexistent-order-${suffix}`,
      requestId: `nonexistent-req-${suffix}`,
      amount: 50000,
      transId: 'trans-unknown',
      resultCode: 0,
    });
    expect(unknownResult.status).toBe('IGNORED_MISMATCH');
  });

  it('ignores notifications with mismatched immutable amount or requestId', async () => {
    const orderId = `momo-order-mismatch-${suffix}`;
    const requestId = `momo-req-mismatch-${suffix}`;

    const payment = await paymentService.createPendingPayment({
      userId: testUserId,
      momoOrderId: orderId,
      momoRequestId: requestId,
    });

    const wrongAmountResult = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId,
      amount: 10000, // Expected 50,000
      transId: 'trans-bad-amount',
      resultCode: 0,
    });
    expect(wrongAmountResult.status).toBe('IGNORED_MISMATCH');

    const wrongReqResult = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId: 'wrong-req-id',
      amount: 50000,
      transId: 'trans-bad-req',
      resultCode: 0,
    });
    expect(wrongReqResult.status).toBe('IGNORED_MISMATCH');

    const unchangedPayment = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
    });
    expect(unchangedPayment?.status).toBe('PENDING');
  });

  it('marks payment FAILED on provider failure without storing momoTransactionId and handles shared failed transId cleanly', async () => {
    const failUser = await prisma.user.create({
      data: {
        email: `buyer-fail-${suffix}@payment-test.com`,
        displayName: 'Payment Failure Buyer',
      },
    });

    const orderId1 = `momo-order-fail1-${suffix}`;
    const requestId1 = `momo-req-fail1-${suffix}`;
    const orderId2 = `momo-order-fail2-${suffix}`;
    const requestId2 = `momo-req-fail2-${suffix}`;

    const pay1 = await paymentService.createPendingPayment({
      userId: failUser.id,
      momoOrderId: orderId1,
      momoRequestId: requestId1,
    });
    const pay2 = await paymentService.createPendingPayment({
      userId: failUser.id,
      momoOrderId: orderId2,
      momoRequestId: requestId2,
    });

    const result1 = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId: orderId1,
      requestId: requestId1,
      amount: 50000,
      transId: '0',
      resultCode: 1006, // User cancelled
    });

    const result2 = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId: orderId2,
      requestId: requestId2,
      amount: 50000,
      transId: '0',
      resultCode: 1006, // User cancelled with same sentinel transId
    });

    expect(result1.status).toBe('FAILED');
    expect(result1.subscriptionId).toBeUndefined();
    expect(result2.status).toBe('FAILED');
    expect(result2.subscriptionId).toBeUndefined();

    const updated1 = await prisma.subscriptionPayment.findUnique({
      where: { id: pay1.id },
    });
    const updated2 = await prisma.subscriptionPayment.findUnique({
      where: { id: pay2.id },
    });

    expect(updated1?.status).toBe('FAILED');
    expect(updated1?.momoResultCode).toBe(1006);
    expect(updated1?.momoTransactionId).toBeNull();

    expect(updated2?.status).toBe('FAILED');
    expect(updated2?.momoResultCode).toBe(1006);
    expect(updated2?.momoTransactionId).toBeNull();

    // Verify zero Subscription rows created for failUser
    const subCount = await prisma.subscription.count({
      where: { userId: failUser.id },
    });
    expect(subCount).toBe(0);

    await prisma.subscriptionPayment.deleteMany({ where: { userId: failUser.id } });
    await prisma.user.delete({ where: { id: failUser.id } });
  });

  it('extends an active subscription seamlessly from the latest expiry date', async () => {
    const extUser = await prisma.user.create({
      data: {
        email: `buyer-ext-${suffix}@payment-test.com`,
        displayName: 'Payment Extension Buyer',
      },
    });

    const now = new Date();
    const futureExpiry = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now

    const activeSub = await prisma.subscription.create({
      data: {
        userId: extUser.id,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt: futureExpiry,
        note: 'Existing active sub',
      },
    });

    const orderId = `momo-order-ext-${suffix}`;
    const requestId = `momo-req-ext-${suffix}`;

    await paymentService.createPendingPayment({
      userId: extUser.id,
      momoOrderId: orderId,
      momoRequestId: requestId,
    });

    const result = await paymentService.processVerifiedNotification({
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId,
      amount: 50000,
      transId: 'trans-ext',
      resultCode: 0,
    });

    expect(result.status).toBe('PAID');
    expect(result.subscriptionId).toBeTruthy();

    const newSub = await prisma.subscription.findUnique({
      where: { id: result.subscriptionId! },
    });
    expect(newSub?.status).toBe('ACTIVE');
    expect(newSub?.startsAt.getTime()).toBe(activeSub.expiresAt.getTime());

    const expectedNewExpiry = new Date(
      activeSub.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    expect(newSub?.expiresAt.getTime()).toBe(expectedNewExpiry.getTime());

    await prisma.subscriptionPayment.deleteMany({ where: { userId: extUser.id } });
    await prisma.subscription.deleteMany({ where: { userId: extUser.id } });
    await prisma.user.delete({ where: { id: extUser.id } });
  });

  it('handles two identical IPNs under concurrent Promise.all safely yielding exactly one Subscription', async () => {
    const concUser = await prisma.user.create({
      data: {
        email: `buyer-conc1-${suffix}@payment-test.com`,
        displayName: 'Concurrent Same IPN Buyer',
      },
    });

    const orderId = `momo-order-conc1-${suffix}`;
    const requestId = `momo-req-conc1-${suffix}`;

    await paymentService.createPendingPayment({
      userId: concUser.id,
      momoOrderId: orderId,
      momoRequestId: requestId,
    });

    const notification = {
      partnerCode: 'MOMO_TEST',
      orderId,
      requestId,
      amount: 50000,
      transId: 'trans-conc-1',
      resultCode: 0,
    };

    const [res1, res2] = await Promise.all([
      paymentService.processVerifiedNotification(notification),
      paymentService.processVerifiedNotification(notification),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual(['DUPLICATE', 'PAID']);

    // Explicitly count Subscription rows, not SubscriptionPayment rows
    const subCount = await prisma.subscription.count({
      where: { userId: concUser.id },
    });
    expect(subCount).toBe(1);

    await prisma.subscriptionPayment.deleteMany({ where: { userId: concUser.id } });
    await prisma.subscription.deleteMany({ where: { userId: concUser.id } });
    await prisma.user.delete({ where: { id: concUser.id } });
  });

  it('handles two distinct paid orders for one user under concurrent Promise.all into two contiguous 30-day periods with no overlap', async () => {
    const concUser = await prisma.user.create({
      data: {
        email: `buyer-conc2-${suffix}@payment-test.com`,
        displayName: 'Concurrent Distinct Orders Buyer',
      },
    });

    const orderIdA = `momo-order-conc2a-${suffix}`;
    const requestIdA = `momo-req-conc2a-${suffix}`;
    const orderIdB = `momo-order-conc2b-${suffix}`;
    const requestIdB = `momo-req-conc2b-${suffix}`;

    await paymentService.createPendingPayment({
      userId: concUser.id,
      momoOrderId: orderIdA,
      momoRequestId: requestIdA,
    });
    await paymentService.createPendingPayment({
      userId: concUser.id,
      momoOrderId: orderIdB,
      momoRequestId: requestIdB,
    });

    const notificationA = {
      partnerCode: 'MOMO_TEST',
      orderId: orderIdA,
      requestId: requestIdA,
      amount: 50000,
      transId: 'trans-conc-2a',
      resultCode: 0,
    };
    const notificationB = {
      partnerCode: 'MOMO_TEST',
      orderId: orderIdB,
      requestId: requestIdB,
      amount: 50000,
      transId: 'trans-conc-2b',
      resultCode: 0,
    };

    const [resA, resB] = await Promise.all([
      paymentService.processVerifiedNotification(notificationA),
      paymentService.processVerifiedNotification(notificationB),
    ]);

    expect(resA.status).toBe('PAID');
    expect(resB.status).toBe('PAID');

    // Explicitly count Subscription rows, not SubscriptionPayment rows
    const subCount = await prisma.subscription.count({
      where: { userId: concUser.id },
    });
    expect(subCount).toBe(2);

    const subs = await prisma.subscription.findMany({
      where: { userId: concUser.id },
      orderBy: { startsAt: 'asc' },
    });

    const sub1 = subs[0]!;
    const sub2 = subs[1]!;

    // Second subscription starts exactly when the first subscription expires (contiguous, 0 overlap)
    expect(sub2.startsAt.getTime()).toBe(sub1.expiresAt.getTime());

    // Total duration across both contiguous subscriptions is exactly 60 days
    const totalDurationMs = sub2.expiresAt.getTime() - sub1.startsAt.getTime();
    expect(totalDurationMs).toBe(60 * 24 * 60 * 60 * 1000);

    await prisma.subscriptionPayment.deleteMany({ where: { userId: concUser.id } });
    await prisma.subscription.deleteMany({ where: { userId: concUser.id } });
    await prisma.user.delete({ where: { id: concUser.id } });
  });
});
