import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PaymentService,
  type VerifiedPaymentNotification,
} from '../src/payment/payment.service';
import { PAYOS_DESCRIPTION } from '../src/payment/payos-config';
import './setup-env';

/**
 * The provider-agnostic half of the money path. Every test here calls
 * processVerifiedNotification directly, past signature verification, so nothing
 * in this file depends on payOS's protocol — only on what a verified payment
 * must do to the database. It survived the MoMo-to-payOS swap for that reason.
 */
describe('Payment activation domain integration', () => {
  let prisma: PrismaService;
  let paymentService: PaymentService;
  let testUserId: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let reference = 0;

  /** A verified webhook for a payment, defaulting to a successful one. */
  function notificationFor(
    payment: { providerOrderId: string; providerPaymentId: string | null },
    overrides: Partial<VerifiedPaymentNotification> = {},
  ): VerifiedPaymentNotification {
    reference += 1;
    return {
      orderCode: payment.providerOrderId,
      amount: 50000,
      description: PAYOS_DESCRIPTION,
      reference: `TF${suffix}-${reference}`,
      paymentLinkId: payment.providerPaymentId ?? `link-${suffix}-${reference}`,
      code: '00',
      ...overrides,
    };
  }

  /** Mirrors what startCheckout stores once payOS answers. */
  async function pendingWithLink(label: string) {
    const payment = await paymentService.createPendingPayment(testUserId);
    return prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { providerPaymentId: `link-${label}-${suffix}` },
    });
  }

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

  it('generates a positive, safe-integer orderCode that is unique per payment', async () => {
    const a = await paymentService.createPendingPayment(testUserId);
    const b = await paymentService.createPendingPayment(testUserId);

    for (const payment of [a, b]) {
      const code = Number(payment.providerOrderId);
      expect(Number.isSafeInteger(code)).toBe(true);
      expect(code).toBeGreaterThan(0);
      expect(payment.provider).toBe('PAYOS');
      expect(payment.providerDescription).toBe(PAYOS_DESCRIPTION);
      // Not known until payOS answers; a create that times out leaves it null.
      expect(payment.providerPaymentId).toBeNull();
    }
    expect(a.providerOrderId).not.toBe(b.providerOrderId);
  });

  it('activates a pending payment into exactly one 30-day active subscription', async () => {
    const payment = await pendingWithLink('first');
    expect(payment.status).toBe('PENDING');

    const notification = notificationFor(payment);
    const result = await paymentService.processVerifiedNotification(
      notification,
    );

    expect(result.status).toBe('PAID');
    expect(result.paymentId).toBe(payment.id);
    expect(result.subscriptionId).toBeTruthy();

    const updated = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
      include: { subscription: true },
    });
    expect(updated?.status).toBe('PAID');
    expect(updated?.providerTransactionId).toBe(notification.reference);
    expect(updated?.providerResultCode).toBe('00');
    expect(updated?.paidAt).toBeTruthy();
    expect(updated?.subscription?.status).toBe('ACTIVE');
    // Nothing a reader might see carries an internal or provider identifier.
    expect(updated?.subscription?.note).toBeNull();

    const days =
      (updated!.subscription!.expiresAt.getTime() -
        updated!.subscription!.startsAt.getTime()) /
      86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('handles a duplicate webhook idempotently without adding extra time', async () => {
    const payment = await pendingWithLink('dup');
    const notification = notificationFor(payment);

    const first = await paymentService.processVerifiedNotification(notification);
    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });

    const second = await paymentService.processVerifiedNotification(
      notification,
    );

    expect(first.status).toBe('PAID');
    expect(second.status).toBe('DUPLICATE');
    expect(second.subscriptionId).toBe(first.subscriptionId);
    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before);
  });

  it('ignores a webhook for an orderCode we never issued', async () => {
    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });

    // This is also the shape payOS's confirm-webhook probe arrives in.
    const result = await paymentService.processVerifiedNotification({
      orderCode: '9007199254740000',
      amount: 50000,
      description: PAYOS_DESCRIPTION,
      reference: `TF-unknown-${suffix}`,
      paymentLinkId: `link-unknown-${suffix}`,
      code: '00',
    });

    expect(result.status).toBe('IGNORED_MISMATCH');
    expect(result.subscriptionId).toBeUndefined();
    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before);
  });

  it.each([
    ['amount', { amount: 1 }],
    ['description', { description: 'OTHER' }],
    ['paymentLinkId', { paymentLinkId: 'someone-elses-link' }],
  ])('grants nothing when the signed %s disagrees with the row', async (
    _field,
    override,
  ) => {
    const payment = await pendingWithLink(`mismatch-${_field}`);
    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });

    const result = await paymentService.processVerifiedNotification(
      notificationFor(payment, override),
    );

    expect(result.status).toBe('IGNORED_MISMATCH');
    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before);
    const untouched = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
    });
    expect(untouched?.status).toBe('PENDING');
    expect(untouched?.providerTransactionId).toBeNull();
  });

  it('lets a signed webhook claim a payment whose create call never returned', async () => {
    // providerPaymentId is null: payOS accepted the order but the response was
    // lost. Refusing here would punish a payer for our timeout.
    const payment = await paymentService.createPendingPayment(testUserId);
    expect(payment.providerPaymentId).toBeNull();

    const notification = notificationFor(payment, {
      paymentLinkId: `recovered-link-${suffix}`,
    });
    const result = await paymentService.processVerifiedNotification(
      notification,
    );

    expect(result.status).toBe('PAID');
    const updated = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
    });
    expect(updated?.providerPaymentId).toBe(`recovered-link-${suffix}`);
    expect(updated?.status).toBe('PAID');
  });

  it('records a non-success code but leaves the row claimable', async () => {
    // payOS documents no terminal-failure webhook for the payment-link flow.
    // Resolving the row here would discard a success arriving afterwards.
    const payment = await pendingWithLink('nonsuccess');

    const pending = await paymentService.processVerifiedNotification(
      notificationFor(payment, { code: '01' }),
    );
    expect(pending.status).toBe('PENDING');

    const midway = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
    });
    expect(midway?.status).toBe('PENDING');
    expect(midway?.providerResultCode).toBe('01');
    // No transaction id is stored: the column is unique, and a placeholder
    // would collide with the next callback.
    expect(midway?.providerTransactionId).toBeNull();

    const later = await paymentService.processVerifiedNotification(
      notificationFor(payment),
    );
    expect(later.status).toBe('PAID');
  });

  it('refuses to reuse a bank reference on a second payment', async () => {
    const first = await pendingWithLink('ref-a');
    const second = await pendingWithLink('ref-b');

    const notification = notificationFor(first);
    expect(
      (await paymentService.processVerifiedNotification(notification)).status,
    ).toBe('PAID');

    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });
    const replay = await paymentService.processVerifiedNotification({
      ...notificationFor(second),
      // Same bank transfer, pointed at a different order.
      reference: notification.reference,
    });

    expect(replay.status).toBe('IGNORED_MISMATCH');
    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before);
    const untouched = await prisma.subscriptionPayment.findUnique({
      where: { id: second.id },
    });
    expect(untouched?.status).toBe('PENDING');
  });

  it('lets only one of two concurrent orders claim the same bank reference', async () => {
    // The sequential version above proves the guard; this proves it holds when
    // both webhooks are in flight at once, which is when a check-then-write
    // would let both through and hand out two subscriptions for one transfer.
    const first = await pendingWithLink('conc-ref-a');
    const second = await pendingWithLink('conc-ref-b');
    const shared = `TF-shared-${suffix}`;
    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });

    const results = await Promise.all([
      paymentService.processVerifiedNotification(
        notificationFor(first, { reference: shared }),
      ),
      paymentService.processVerifiedNotification(
        notificationFor(second, { reference: shared }),
      ),
    ]);

    expect(results.filter((r) => r.status === 'PAID')).toHaveLength(1);
    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before + 1);

    const rows = await prisma.subscriptionPayment.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(rows.filter((r) => r.status === 'PAID')).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'PENDING')).toHaveLength(1);
    // The reference is recorded exactly once, on the winner.
    expect(
      rows.filter((r) => r.providerTransactionId === shared),
    ).toHaveLength(1);
  });

  it('extends an active subscription seamlessly from the latest expiry date', async () => {
    const first = await pendingWithLink('ext-1');
    await paymentService.processVerifiedNotification(notificationFor(first));
    const firstSub = await prisma.subscription.findFirst({
      where: { userId: testUserId },
      orderBy: { expiresAt: 'desc' },
    });

    const second = await pendingWithLink('ext-2');
    await paymentService.processVerifiedNotification(notificationFor(second));
    const secondSub = await prisma.subscription.findFirst({
      where: { userId: testUserId },
      orderBy: { expiresAt: 'desc' },
    });

    // Contiguous: the new period begins exactly where the old one ends, so no
    // paid time is lost and no two periods overlap.
    expect(secondSub!.startsAt.getTime()).toBe(firstSub!.expiresAt.getTime());
    const days =
      (secondSub!.expiresAt.getTime() - secondSub!.startsAt.getTime()) /
      86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('creates exactly one subscription when two identical webhooks race', async () => {
    const payment = await pendingWithLink('race');
    const notification = notificationFor(payment);
    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });

    const results = await Promise.all([
      paymentService.processVerifiedNotification(notification),
      paymentService.processVerifiedNotification(notification),
    ]);

    expect(results.filter((r) => r.status === 'PAID')).toHaveLength(1);
    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before + 1);
  });

  it('gives two concurrent distinct orders two contiguous periods', async () => {
    const a = await pendingWithLink('conc-a');
    const b = await pendingWithLink('conc-b');
    const before = await prisma.subscription.count({
      where: { userId: testUserId },
    });

    await Promise.all([
      paymentService.processVerifiedNotification(notificationFor(a)),
      paymentService.processVerifiedNotification(notificationFor(b)),
    ]);

    expect(
      await prisma.subscription.count({ where: { userId: testUserId } }),
    ).toBe(before + 2);

    const subs = await prisma.subscription.findMany({
      where: { userId: testUserId },
      orderBy: { startsAt: 'asc' },
    });
    const last = subs.slice(-2);
    // No overlap and no lost paid time: 60 days total across the two periods.
    expect(last[1]!.startsAt.getTime()).toBe(last[0]!.expiresAt.getTime());
    const totalDays =
      (last[1]!.expiresAt.getTime() - last[0]!.startsAt.getTime()) / 86_400_000;
    expect(Math.round(totalDays)).toBe(60);
  });
});
