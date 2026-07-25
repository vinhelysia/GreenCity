import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  MOMO_EXTRA_DATA,
  MOMO_IPN_PATH,
  MOMO_ORDER_INFO,
  MOMO_ORDER_TYPE,
} from '../src/payment/momo-config';
import {
  buildIpnRawSignature,
  signMomoPayload,
} from '../src/payment/momo-signature';
import './setup-env';

/**
 * The signed MoMo callback, over real HTTP. It carries no cookie and no Origin,
 * so these tests double as proof that the narrow OriginGuard exemption works —
 * and, just as importantly, that it did not open the rest of the application.
 */
describe('MoMo IPN webhook integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const ORIGIN = 'http://localhost:3000';
  const PARTNER_CODE = 'GCWEBHOOKPARTNER';
  const SECRET = 'test-secret-not-a-credential';
  const ACCESS_KEY = 'test-access-key';

  const MOMO_ENV_KEYS = [
    'MOMO_ENV',
    'MOMO_PARTNER_CODE',
    'MOMO_ACCESS_KEY',
    'MOMO_SECRET_KEY',
    'PUBLIC_API_URL',
    'PUBLIC_WEB_URL',
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};
  const originalFetch = globalThis.fetch;

  let userId: string;
  let orderSeq = 0;
  /**
   * Separate from orderSeq: momoTransactionId is unique, and two orders sharing
   * a transaction id collide on the second activation. Real callbacks carry a
   * distinct id per transaction, so the fixture must too.
   */
  let transSeq = 0;

  interface IpnFields {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    orderInfo: string;
    orderType: string;
    transId: number;
    resultCode: number;
    message: string;
    payType: string;
    responseTime: number;
    extraData: string;
  }

  /** A callback MoMo would actually send, signed with the configured secret. */
  function signedIpn(overrides: Partial<IpnFields> = {}): Record<string, unknown> {
    transSeq += 1;
    const fields: IpnFields = {
      partnerCode: PARTNER_CODE,
      orderId: 'unset',
      requestId: 'unset',
      amount: 50000,
      orderInfo: MOMO_ORDER_INFO,
      orderType: MOMO_ORDER_TYPE,
      transId: 900000 + transSeq,
      resultCode: 0,
      message: 'Successful.',
      payType: 'webApp',
      responseTime: 1735689600000,
      extraData: MOMO_EXTRA_DATA,
      ...overrides,
    };
    const signature = signMomoPayload(
      buildIpnRawSignature({ accessKey: ACCESS_KEY, ...fields }),
      SECRET,
    );
    return { ...fields, signature };
  }

  function postIpn(body: Record<string, unknown>) {
    // No cookie, no Origin: exactly how MoMo calls us.
    return request(app.getHttpServer()).post(MOMO_IPN_PATH).send(body);
  }

  async function makePending(): Promise<{ orderId: string; requestId: string }> {
    orderSeq += 1;
    const orderId = `gc-order-${suffix}-${orderSeq}`;
    const requestId = `gc-req-${suffix}-${orderSeq}`;
    await prisma.subscriptionPayment.create({
      data: {
        userId,
        amountVnd: 50000,
        durationDays: 30,
        status: 'PENDING',
        momoOrderId: orderId,
        momoRequestId: requestId,
      },
    });
    return { orderId, requestId };
  }

  const paymentFor = (orderId: string) =>
    prisma.subscriptionPayment.findUniqueOrThrow({
      where: { momoOrderId: orderId },
    });
  const subscriptionCount = () =>
    prisma.subscription.count({ where: { userId } });

  beforeAll(async () => {
    for (const key of MOMO_ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.MOMO_ENV = 'sandbox';
    process.env.MOMO_PARTNER_CODE = PARTNER_CODE;
    process.env.MOMO_ACCESS_KEY = ACCESS_KEY;
    process.env.MOMO_SECRET_KEY = SECRET;
    process.env.PUBLIC_API_URL = 'https://api.example.test';
    process.env.PUBLIC_WEB_URL = 'https://web.example.test';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: { email: `ipn-${suffix}@webhook.test`, displayName: 'IPN Buyer' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    for (const key of MOMO_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (prisma && userId) {
      await prisma.subscriptionPayment
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await prisma.subscription
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    // Any outbound call from a webhook would be a defect; make one impossible.
    globalThis.fetch = (() => {
      throw new Error('the webhook must not perform outbound HTTP');
    }) as unknown as typeof fetch;
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.subscriptionPayment.deleteMany({ where: { userId } });
  });

  // ── the exemption, and its limits ─────────────────────────────────────────

  it('accepts a signed callback with neither session cookie nor Origin', async () => {
    const { orderId, requestId } = await makePending();
    const res = await postIpn(signedIpn({ orderId, requestId }));

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(res.body).toEqual({});
  });

  it('leaves every other public POST behind the Origin check', async () => {
    // Same shape of request — public, no Origin — on a route that did not opt
    // in. If this ever succeeds, the exemption stopped being narrow.
    const blockedEmail = `probe-blocked-${suffix}@origin.test`;
    const allowedEmail = `probe-allowed-${suffix}@origin.test`;

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: blockedEmail, password: 'password-123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ORIGIN');

    // And the same route still works when the Origin is present.
    const allowed = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', ORIGIN)
      .send({ email: allowedEmail, password: 'password-123' });
    expect(allowed.status).toBe(201);

    // Exact addresses only: a `contains` match here once swept up this suite's
    // own buyer and every later test died on a foreign key.
    await prisma.session
      .deleteMany({ where: { user: { email: allowedEmail } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { email: { in: [blockedEmail, allowedEmail] } } })
      .catch(() => undefined);
  });

  // ── rejection paths ───────────────────────────────────────────────────────

  it('rejects a malformed payload without touching the row', async () => {
    const { orderId } = await makePending();
    const res = await postIpn({ orderId, amount: 'fifty thousand' });

    expect(res.status).toBe(400);
    expect((await paymentFor(orderId)).status).toBe('PENDING');
    expect(await subscriptionCount()).toBe(0);
  });

  it.each([
    // Absent entirely: the schema rejects it before any signature work.
    [
      'a missing signature',
      400,
      (b: Record<string, unknown>) => ({ ...b, signature: undefined }),
    ],
    // Present but not a 64-char hex digest: refused before Buffer.from, which
    // would otherwise truncate silently at the first invalid nibble.
    [
      'a malformed signature',
      401,
      (b: Record<string, unknown>) => ({ ...b, signature: 'zz' }),
    ],
    [
      'a signature of the right shape but the wrong value',
      401,
      (b: Record<string, unknown>) => ({ ...b, signature: 'a'.repeat(64) }),
    ],
  ])(
    'rejects %s with %i and mutates nothing',
    async (_label, expectedStatus, mutate) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(mutate(signedIpn({ orderId, requestId })));

      expect(res.status).toBe(expectedStatus);
      expect((await paymentFor(orderId)).status).toBe('PENDING');
      expect(await subscriptionCount()).toBe(0);
    },
  );

  it('rejects a signature computed over a different payload', async () => {
    const { orderId, requestId } = await makePending();
    // Signed correctly — for a different amount than the one being sent. This
    // is the case a "sign whatever we received" verifier would wave through.
    const honest = signedIpn({ orderId, requestId, amount: 50000 });
    const tampered = { ...honest, amount: 1 };

    const res = await postIpn(tampered);

    expect(res.status).toBe(401);
    expect((await paymentFor(orderId)).status).toBe('PENDING');
    expect(await subscriptionCount()).toBe(0);
  });

  it.each([
    ['partnerCode', { partnerCode: 'SOMEONE-ELSE' }],
    ['orderInfo', { orderInfo: 'a different description' }],
    ['extraData', { extraData: 'unexpected-state' }],
    ['orderType', { orderType: 'momo_bank' }],
  ])(
    'rejects a correctly signed callback whose %s is not ours',
    async (_label, overrides) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(signedIpn({ orderId, requestId, ...overrides }));

      expect(res.status).toBe(401);
      expect((await paymentFor(orderId)).status).toBe('PENDING');
      expect(await subscriptionCount()).toBe(0);
    },
  );

  // ── result-code classification ────────────────────────────────────────────

  it.each([[0], [9000]])(
    'activates exactly one subscription on resultCode %i',
    async (resultCode) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(signedIpn({ orderId, requestId, resultCode }));

      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      const payment = await paymentFor(orderId);
      expect(payment.status).toBe('PAID');
      expect(payment.paidAt).not.toBeNull();
      expect(payment.subscriptionId).not.toBeNull();
      expect(await subscriptionCount()).toBe(1);
    },
  );

  it.each([[1000], [7000], [7002]])(
    'keeps the payment PENDING and grants nothing on in-flight code %i',
    async (resultCode) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(signedIpn({ orderId, requestId, resultCode }));

      expect(res.status).toBe(204);
      const payment = await paymentFor(orderId);
      expect(payment.status).toBe('PENDING');
      expect(payment.momoResultCode).toBe(resultCode);
      // No placeholder id: the column is unique, and a sentinel would collide
      // with the next in-flight callback.
      expect(payment.momoTransactionId).toBeNull();
      expect(payment.subscriptionId).toBeNull();
      expect(await subscriptionCount()).toBe(0);
    },
  );

  // MoMo publishes many codes whose final status is "no". Resolving one of them
  // to FAILED would take the row out of the claimable state, and the success
  // callback that follows would be discarded as a duplicate — a paying user
  // silently loses access. Unrecognised codes must therefore stay open.
  it.each([[10], [11], [20], [40], [43], [47], [123456]])(
    'keeps a non-final or unknown code %i PENDING and grants nothing',
    async (resultCode) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(signedIpn({ orderId, requestId, resultCode }));

      expect(res.status).toBe(204);
      const payment = await paymentFor(orderId);
      expect(payment.status).toBe('PENDING');
      expect(payment.momoResultCode).toBe(resultCode);
      expect(await subscriptionCount()).toBe(0);
    },
  );

  it.each([[10], [43]])(
    'still activates when success follows non-final code %i',
    async (resultCode) => {
      const { orderId, requestId } = await makePending();

      await postIpn(signedIpn({ orderId, requestId, resultCode }));
      expect((await paymentFor(orderId)).status).toBe('PENDING');

      const success = await postIpn(
        signedIpn({ orderId, requestId, resultCode: 0 }),
      );

      expect(success.status).toBe(204);
      expect((await paymentFor(orderId)).status).toBe('PAID');
      expect(await subscriptionCount()).toBe(1);
    },
  );

  // Every code MoMo's result table marks final for a wallet payment. Listed
  // one by one rather than imported from the service: a test that reuses the
  // production set would agree with it however wrong it became.
  const TERMINAL_CODES = [
    98, 99, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 4001, 4002,
    4100,
  ];

  it.each(TERMINAL_CODES.map((code) => [code]))(
    'marks terminal code %i FAILED with no transaction id',
    async (resultCode) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(signedIpn({ orderId, requestId, resultCode }));

      expect(res.status).toBe(204);
      const payment = await paymentFor(orderId);
      expect(payment.status).toBe('FAILED');
      expect(payment.momoResultCode).toBe(resultCode);
      expect(payment.momoTransactionId).toBeNull();
      expect(payment.subscriptionId).toBeNull();
      expect(await subscriptionCount()).toBe(0);
    },
  );

  it('does not activate when a success callback follows a terminal failure', async () => {
    const { orderId, requestId } = await makePending();

    await postIpn(signedIpn({ orderId, requestId, resultCode: 1006 }));
    expect((await paymentFor(orderId)).status).toBe('FAILED');

    // A resolved row is no longer claimable, so this is absorbed as a
    // duplicate. Anything else would let a late success reopen a settled
    // failure and mint a subscription nobody paid for.
    const late = await postIpn(signedIpn({ orderId, requestId, resultCode: 0 }));

    expect(late.status).toBe(204);
    expect((await paymentFor(orderId)).status).toBe('FAILED');
    expect(await subscriptionCount()).toBe(0);
  });

  // ── orders we do not recognise ────────────────────────────────────────────

  it('absorbs an unknown order as 204 without creating anything', async () => {
    const res = await postIpn(
      signedIpn({ orderId: `ghost-${suffix}`, requestId: `ghost-req-${suffix}` }),
    );

    expect(res.status).toBe(204);
    expect(await subscriptionCount()).toBe(0);
    expect(
      await prisma.subscriptionPayment.count({ where: { userId } }),
    ).toBe(0);
  });

  it.each([
    ['amount', { amount: 999_000 }],
    ['requestId', { requestId: 'not-the-stored-one' }],
  ])(
    'grants no access when the signed %s disagrees with the stored row',
    async (_label, overrides) => {
      const { orderId, requestId } = await makePending();
      const res = await postIpn(signedIpn({ orderId, requestId, ...overrides }));

      expect(res.status).toBe(204);
      expect((await paymentFor(orderId)).status).toBe('PENDING');
      expect(await subscriptionCount()).toBe(0);
    },
  );

  // ── idempotency and ordering ──────────────────────────────────────────────

  it('creates exactly one subscription for a duplicated success callback', async () => {
    const { orderId, requestId } = await makePending();
    const body = signedIpn({ orderId, requestId });

    expect((await postIpn(body)).status).toBe(204);
    expect((await postIpn(body)).status).toBe(204);

    expect(await subscriptionCount()).toBe(1);
  });

  it('creates exactly one subscription when two identical callbacks race', async () => {
    const { orderId, requestId } = await makePending();
    const body = signedIpn({ orderId, requestId });

    const [a, b] = await Promise.all([postIpn(body), postIpn(body)]);
    expect(a.status).toBe(204);
    expect(b.status).toBe(204);

    expect(await subscriptionCount()).toBe(1);
    expect((await paymentFor(orderId)).status).toBe('PAID');
  });

  it('settles PAID when an in-flight callback precedes the success', async () => {
    const { orderId, requestId } = await makePending();

    await postIpn(signedIpn({ orderId, requestId, resultCode: 1000 }));
    expect((await paymentFor(orderId)).status).toBe('PENDING');

    await postIpn(signedIpn({ orderId, requestId, resultCode: 0 }));

    expect((await paymentFor(orderId)).status).toBe('PAID');
    expect(await subscriptionCount()).toBe(1);
  });

  it('stays PAID when a late in-flight callback arrives after the success', async () => {
    const { orderId, requestId } = await makePending();

    await postIpn(signedIpn({ orderId, requestId, resultCode: 0 }));
    const late = await postIpn(signedIpn({ orderId, requestId, resultCode: 1000 }));

    expect(late.status).toBe(204);
    expect((await paymentFor(orderId)).status).toBe('PAID');
    expect(await subscriptionCount()).toBe(1);
  });

  it('gives two separate paid orders 60 days in total', async () => {
    const first = await makePending();
    const second = await makePending();

    await postIpn(signedIpn({ orderId: first.orderId, requestId: first.requestId }));
    await postIpn(
      signedIpn({ orderId: second.orderId, requestId: second.requestId }),
    );

    const subs = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { startsAt: 'asc' },
    });
    expect(subs).toHaveLength(2);
    // The second stacks on the first rather than overwriting it.
    expect(subs[1]!.startsAt.getTime()).toBe(subs[0]!.expiresAt.getTime());
    const totalDays =
      (subs[1]!.expiresAt.getTime() - subs[0]!.startsAt.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(Math.round(totalDays)).toBe(60);
  });

  // ── server faults must be retryable ───────────────────────────────────────

  it('answers 5xx when the database fails, so MoMo retries', async () => {
    const { orderId, requestId } = await makePending();
    const service = app.get(PrismaService);
    // $transaction, not the model method: activation runs entirely on the
    // transaction client, so replacing prisma.subscriptionPayment.* is never
    // reached and the request quietly succeeds instead of failing.
    const original = service.$transaction.bind(service);
    service.$transaction = (() => {
      throw new Error('connection reset');
    }) as typeof service.$transaction;

    try {
      const res = await postIpn(signedIpn({ orderId, requestId }));
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.status).not.toBe(204);
    } finally {
      service.$transaction = original as typeof service.$transaction;
    }

    expect(await subscriptionCount()).toBe(0);
  });
});
