import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PAYOS_DESCRIPTION,
  PAYOS_WEBHOOK_PATH,
} from '../src/payment/payos-config';
import {
  canonicalizeData,
  signPayosPayload,
} from '../src/payment/payos-signature';
import './setup-env';

/**
 * The signed payOS callback, over real HTTP. It carries no cookie and no Origin,
 * so these tests double as proof that the narrow OriginGuard exemption works —
 * and, just as importantly, that it did not open the rest of the application.
 *
 * Nothing here contacts payOS. Every credential is obviously fake except the
 * public checksum key payOS publishes in its own signature documentation, which
 * is used only to pin the golden fixture below.
 */
describe('payOS webhook integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const ORIGIN = 'http://localhost:3000';
  const CHECKSUM_KEY = 'test-checksum-key-not-a-credential';

  /**
   * OFFICIAL DOCUMENTATION TEST DATA — the public sample from
   * https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/
   * Not a credential of this project. Used to prove the endpoint accepts a
   * signature payOS itself published, rather than only ones we generated.
   */
  const DOC_CHECKSUM_KEY =
    '1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675';
  const DOC_DATA = {
    orderCode: 123,
    amount: 3000,
    description: 'VQRIO123',
    accountNumber: '12345678',
    reference: 'TF230204212323',
    transactionDateTime: '2023-02-04 18:25:00',
    currency: 'VND',
    paymentLinkId: '124c33293c43417ab7879e14c8d9eb18',
    code: '00',
    desc: 'Thành công',
    counterAccountBankId: '',
    counterAccountBankName: '',
    counterAccountName: '',
    counterAccountNumber: '',
    virtualAccountName: '',
    virtualAccountNumber: '',
  };
  const DOC_SIGNATURE =
    '412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03';

  const PAYOS_ENV_KEYS = [
    'PAYOS_CLIENT_ID',
    'PAYOS_API_KEY',
    'PAYOS_CHECKSUM_KEY',
    'PUBLIC_API_URL',
    'PUBLIC_WEB_URL',
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};
  const originalFetch = globalThis.fetch;

  let userId: string;
  let orderSeq = 0;
  /**
   * Separate from orderSeq: providerTransactionId is unique, and two orders
   * sharing a bank reference collide on the second activation. Real callbacks
   * carry a distinct reference per transfer, so the fixture must too.
   */
  let refSeq = 0;

  /** The data object payOS signs, with our defaults. */
  function webhookData(overrides: Record<string, unknown> = {}) {
    refSeq += 1;
    return {
      orderCode: 0,
      amount: 50000,
      description: PAYOS_DESCRIPTION,
      accountNumber: '0011000000000',
      reference: `TF${suffix}-${refSeq}`,
      transactionDateTime: '2026-07-26 10:00:00',
      currency: 'VND',
      paymentLinkId: 'unset',
      code: '00',
      desc: 'Thành công',
      counterAccountBankId: '',
      counterAccountBankName: '',
      counterAccountName: '',
      counterAccountNumber: '',
      virtualAccountName: '',
      virtualAccountNumber: '',
      ...overrides,
    };
  }

  /** A callback payOS would actually send, signed with the configured key. */
  function signedWebhook(data: Record<string, unknown>) {
    return {
      code: '00',
      desc: 'success',
      success: true,
      data,
      signature: signPayosPayload(canonicalizeData(data), CHECKSUM_KEY),
    };
  }

  function postWebhook(body: string | object) {
    // No cookie, no Origin: exactly how payOS calls us.
    return request(app.getHttpServer()).post(PAYOS_WEBHOOK_PATH).send(body);
  }

  async function makePending(): Promise<{
    orderCode: number;
    paymentLinkId: string;
  }> {
    orderSeq += 1;
    const orderCode = 1784000000000000 + orderSeq;
    const paymentLinkId = `link-${suffix}-${orderSeq}`;
    await prisma.subscriptionPayment.create({
      data: {
        userId,
        amountVnd: 50000,
        durationDays: 30,
        status: 'PENDING',
        provider: 'PAYOS',
        providerOrderId: String(orderCode),
        providerPaymentId: paymentLinkId,
        providerDescription: PAYOS_DESCRIPTION,
      },
    });
    return { orderCode, paymentLinkId };
  }

  const paymentFor = (orderCode: number) =>
    prisma.subscriptionPayment.findUniqueOrThrow({
      where: { providerOrderId: String(orderCode) },
    });
  const subscriptionCount = () =>
    prisma.subscription.count({ where: { userId } });

  beforeAll(async () => {
    for (const key of PAYOS_ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.PAYOS_CLIENT_ID = 'fake-client-id';
    process.env.PAYOS_API_KEY = 'fake-api-key';
    process.env.PAYOS_CHECKSUM_KEY = CHECKSUM_KEY;
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
      data: { email: `payos-${suffix}@webhook.test`, displayName: 'Webhook Buyer' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    for (const key of PAYOS_ENV_KEYS) {
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
    const { orderCode, paymentLinkId } = await makePending();
    const res = await postWebhook(
      signedWebhook(webhookData({ orderCode, paymentLinkId })),
    );

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

  // ── authentication ────────────────────────────────────────────────────────

  it('accepts the signature payOS publishes in its own documentation', async () => {
    // The anchor against a self-agreeing test suite: this signature was not
    // produced by our signer, it was copied from payOS. If our canonicaliser
    // drifts, this is the test that notices.
    process.env.PAYOS_CHECKSUM_KEY = DOC_CHECKSUM_KEY;
    try {
      const before = await subscriptionCount();
      const res = await postWebhook({
        code: '00',
        desc: 'success',
        success: true,
        data: DOC_DATA,
        signature: DOC_SIGNATURE,
      });

      // Authenticated, but orderCode 123 is not an order we ever issued — the
      // same shape payOS's confirm-webhook probe arrives in.
      expect(res.status).toBe(204);
      expect(await subscriptionCount()).toBe(before);
    } finally {
      process.env.PAYOS_CHECKSUM_KEY = CHECKSUM_KEY;
    }
  });

  it.each([
    ['a non-object body', 'not-json-shaped'],
    ['an empty object', {}],
    ['no data', { code: '00', signature: 'a'.repeat(64) }],
    ['data that is not an object', { code: '00', data: 5, signature: 'a'.repeat(64) }],
  ])('answers 400 to %s', async (_label, body) => {
    const res = await postWebhook(body);
    expect(res.status).toBe(400);
  });

  it('answers 400 when the signature is absent', async () => {
    const { orderCode, paymentLinkId } = await makePending();
    const { signature: _dropped, ...unsigned } = signedWebhook(
      webhookData({ orderCode, paymentLinkId }),
    );
    const res = await postWebhook(unsigned);

    expect(res.status).toBe(400);
    expect((await paymentFor(orderCode)).status).toBe('PENDING');
  });

  it.each([
    ['a wrong signature', 'a'.repeat(64)],
    ['a non-hex signature', 'z'.repeat(64)],
    ['a truncated signature', 'a'.repeat(63)],
  ])('answers 401 to %s and mutates nothing', async (_label, signature) => {
    const { orderCode, paymentLinkId } = await makePending();
    const body = signedWebhook(webhookData({ orderCode, paymentLinkId }));
    const res = await postWebhook({ ...body, signature });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    expect((await paymentFor(orderCode)).status).toBe('PENDING');
    expect(await subscriptionCount()).toBe(0);
  });

  it('rejects a signature computed over a different payload', async () => {
    const { orderCode, paymentLinkId } = await makePending();
    const delivered = webhookData({ orderCode, paymentLinkId });
    const signature = signPayosPayload(
      canonicalizeData({ ...delivered, amount: 1 }),
      CHECKSUM_KEY,
    );

    const res = await postWebhook({
      code: '00',
      desc: 'success',
      data: delivered,
      signature,
    });
    expect(res.status).toBe(401);
    expect((await paymentFor(orderCode)).status).toBe('PENDING');
  });

  it('keeps unknown and empty data fields inside the verified string', async () => {
    // payOS signs the whole data object. A body whose signature covers an extra
    // field must still verify when that field is delivered, and must fail when
    // it is stripped — which is what a Zod schema would silently do.
    const { orderCode, paymentLinkId } = await makePending();
    const data = webhookData({
      orderCode,
      paymentLinkId,
      someFutureField: 'added-by-payos-later',
      anEmptyOne: '',
    });
    const signature = signPayosPayload(canonicalizeData(data), CHECKSUM_KEY);

    const accepted = await postWebhook({ code: '00', data, signature });
    expect(accepted.status).toBe(204);
    expect((await paymentFor(orderCode)).status).toBe('PAID');

    // The same signature over the same body minus the unknown keys must fail.
    const second = await makePending();
    const stripped = webhookData({
      orderCode: second.orderCode,
      paymentLinkId: second.paymentLinkId,
    });
    const strippedSignature = signPayosPayload(
      canonicalizeData({
        ...stripped,
        someFutureField: 'added-by-payos-later',
        anEmptyOne: '',
      }),
      CHECKSUM_KEY,
    );
    const rejected = await postWebhook({
      code: '00',
      data: stripped,
      signature: strippedSignature,
    });
    expect(rejected.status).toBe(401);
  });

  // ── matching the stored order ─────────────────────────────────────────────

  it('absorbs an unknown order as 204 without creating anything', async () => {
    const res = await postWebhook(
      signedWebhook(
        webhookData({ orderCode: 1999999999999999, paymentLinkId: 'nope' }),
      ),
    );

    expect(res.status).toBe(204);
    expect(await subscriptionCount()).toBe(0);
  });

  it.each([
    ['amount', { amount: 1 }],
    ['paymentLinkId', { paymentLinkId: 'someone-elses-link' }],
  ])(
    'grants nothing when the signed %s disagrees with the stored row',
    async (_label, override) => {
      const { orderCode, paymentLinkId } = await makePending();
      const res = await postWebhook(
        signedWebhook(webhookData({ orderCode, paymentLinkId, ...override })),
      );

      expect(res.status).toBe(204);
      expect(await subscriptionCount()).toBe(0);
      const row = await paymentFor(orderCode);
      expect(row.status).toBe('PENDING');
      expect(row.providerTransactionId).toBeNull();
    },
  );

  it('activates when payOS prefixes the signed transfer description', async () => {
    const { orderCode, paymentLinkId } = await makePending();
    const res = await postWebhook(
      signedWebhook(
        webhookData({
          orderCode,
          paymentLinkId,
          description: `CHANNEL ${PAYOS_DESCRIPTION}`,
        }),
      ),
    );

    expect(res.status).toBe(204);
    expect((await paymentFor(orderCode)).status).toBe('PAID');
    expect(await subscriptionCount()).toBe(1);
  });

  it('grants nothing for a currency that is not VND', async () => {
    const { orderCode, paymentLinkId } = await makePending();
    const res = await postWebhook(
      signedWebhook(
        webhookData({ orderCode, paymentLinkId, currency: 'USD' }),
      ),
    );

    expect(res.status).toBe(204);
    expect(await subscriptionCount()).toBe(0);
    expect((await paymentFor(orderCode)).status).toBe('PENDING');
  });

  // ── activation ────────────────────────────────────────────────────────────

  it('creates exactly one subscription for a duplicated callback', async () => {
    const { orderCode, paymentLinkId } = await makePending();
    const body = signedWebhook(webhookData({ orderCode, paymentLinkId }));

    expect((await postWebhook(body)).status).toBe(204);
    expect((await postWebhook(body)).status).toBe(204);

    expect(await subscriptionCount()).toBe(1);
    expect((await paymentFor(orderCode)).status).toBe('PAID');
  });

  it('creates exactly one subscription when two identical callbacks race', async () => {
    const { orderCode, paymentLinkId } = await makePending();
    const body = signedWebhook(webhookData({ orderCode, paymentLinkId }));

    const [a, b] = await Promise.all([postWebhook(body), postWebhook(body)]);
    expect([a.status, b.status]).toEqual([204, 204]);
    expect(await subscriptionCount()).toBe(1);
  });

  it('will not let a reused bank reference activate a second order', async () => {
    const first = await makePending();
    const second = await makePending();
    const firstData = webhookData({
      orderCode: first.orderCode,
      paymentLinkId: first.paymentLinkId,
    });

    expect((await postWebhook(signedWebhook(firstData))).status).toBe(204);

    const replay = await postWebhook(
      signedWebhook(
        webhookData({
          orderCode: second.orderCode,
          paymentLinkId: second.paymentLinkId,
          reference: firstData.reference,
        }),
      ),
    );

    expect(replay.status).toBe(204);
    expect(await subscriptionCount()).toBe(1);
    expect((await paymentFor(second.orderCode)).status).toBe('PENDING');
  });

  it('leaves a non-success code PENDING and still activates on the success that follows', async () => {
    const { orderCode, paymentLinkId } = await makePending();

    const pending = await postWebhook(
      signedWebhook(webhookData({ orderCode, paymentLinkId, code: '01' })),
    );
    expect(pending.status).toBe(204);
    const midway = await paymentFor(orderCode);
    expect(midway.status).toBe('PENDING');
    expect(midway.providerResultCode).toBe('01');
    expect(midway.providerTransactionId).toBeNull();
    expect(await subscriptionCount()).toBe(0);

    const success = await postWebhook(
      signedWebhook(webhookData({ orderCode, paymentLinkId })),
    );
    expect(success.status).toBe(204);
    expect((await paymentFor(orderCode)).status).toBe('PAID');
    expect(await subscriptionCount()).toBe(1);
  });

  it('gives two separate paid orders 60 contiguous days', async () => {
    const first = await makePending();
    const second = await makePending();

    await postWebhook(
      signedWebhook(
        webhookData({
          orderCode: first.orderCode,
          paymentLinkId: first.paymentLinkId,
        }),
      ),
    );
    await postWebhook(
      signedWebhook(
        webhookData({
          orderCode: second.orderCode,
          paymentLinkId: second.paymentLinkId,
        }),
      ),
    );

    const subs = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { startsAt: 'asc' },
    });
    expect(subs).toHaveLength(2);
    expect(subs[1]!.startsAt.getTime()).toBe(subs[0]!.expiresAt.getTime());
    const days =
      (subs[1]!.expiresAt.getTime() - subs[0]!.startsAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(60);
  });

  // ── server faults ─────────────────────────────────────────────────────────

  // ── the webhook must not depend on checkout being configured ─────────────

  describe('with checkout switched off by a missing PUBLIC_WEB_URL', () => {
    let cookie: string;

    beforeEach(async () => {
      // PUBLIC_WEB_URL is the checkout kill switch. Removing it must stop new
      // checkouts without silencing callbacks for transfers already made — and
      // payOS confirms a webhook by POSTing a signed sample to it, so the
      // endpoint has to answer before checkout is ever turned on.
      delete process.env.PUBLIC_WEB_URL;
      delete process.env.PUBLIC_API_URL;

      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Origin', ORIGIN)
        .send({
          email: `switched-off-${suffix}-${orderSeq}@webhook.test`,
          password: 'password-123',
        });
      expect(registered.status).toBe(201);
      const raw = registered.headers['set-cookie'];
      cookie = (Array.isArray(raw) ? raw : [raw])[0] as string;
    });

    afterEach(async () => {
      process.env.PUBLIC_API_URL = 'https://api.example.test';
      process.env.PUBLIC_WEB_URL = 'https://web.example.test';
      await prisma.session
        .deleteMany({ where: { user: { email: { contains: 'switched-off-' } } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { email: { contains: 'switched-off-' } } })
        .catch(() => undefined);
    });

    it('still accepts a valid signed callback and activates the payment', async () => {
      const { orderCode, paymentLinkId } = await makePending();
      const res = await postWebhook(
        signedWebhook(webhookData({ orderCode, paymentLinkId })),
      );

      expect(res.status).toBe(204);
      expect((await paymentFor(orderCode)).status).toBe('PAID');
      expect(await subscriptionCount()).toBe(1);
    });

    it('acknowledges the confirm-webhook probe without creating a Subscription', async () => {
      process.env.PAYOS_CHECKSUM_KEY = DOC_CHECKSUM_KEY;
      try {
        const res = await postWebhook({
          code: '00',
          desc: 'success',
          success: true,
          data: DOC_DATA,
          signature: DOC_SIGNATURE,
        });
        expect(res.status).toBe(204);
        expect(await subscriptionCount()).toBe(0);
      } finally {
        process.env.PAYOS_CHECKSUM_KEY = CHECKSUM_KEY;
      }
    });

    it('still rejects an invalid signature with 401', async () => {
      const { orderCode, paymentLinkId } = await makePending();
      const body = signedWebhook(webhookData({ orderCode, paymentLinkId }));
      const res = await postWebhook({ ...body, signature: 'a'.repeat(64) });

      expect(res.status).toBe(401);
      expect((await paymentFor(orderCode)).status).toBe('PENDING');
    });

    it('keeps checkout switched off: checkoutAvailable is false', async () => {
      const res = await request(app.getHttpServer())
        .get('/subscriptions/me')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.checkoutAvailable).toBe(false);
    });

    it('keeps checkout switched off: starting one is PAYMENT_NOT_CONFIGURED', async () => {
      const res = await request(app.getHttpServer())
        .post('/subscription-payments')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .send({});

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');
    });
  });

  it('answers a generic 503 when the checksum key itself is absent', async () => {
    // The one thing the webhook genuinely needs. Absent, it cannot authenticate
    // anything, and it must not say why to an unauthenticated caller.
    const { orderCode, paymentLinkId } = await makePending();
    const body = signedWebhook(webhookData({ orderCode, paymentLinkId }));
    delete process.env.PAYOS_CHECKSUM_KEY;
    try {
      const res = await postWebhook(body);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');
    } finally {
      process.env.PAYOS_CHECKSUM_KEY = CHECKSUM_KEY;
    }
    expect((await paymentFor(orderCode)).status).toBe('PENDING');
    expect(await subscriptionCount()).toBe(0);
  });

  it('answers 5xx when the database fails, so payOS can retry', async () => {
    // Patched at $transaction, not at a model method: the activation path runs
    // inside the transaction, and stubbing the model would leave the real
    // transaction wrapper untested.
    const { orderCode, paymentLinkId } = await makePending();
    const spy = jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValue(new Error('connection lost'));

    try {
      const res = await postWebhook(
        signedWebhook(webhookData({ orderCode, paymentLinkId })),
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      spy.mockRestore();
    }

    expect((await paymentFor(orderCode)).status).toBe('PENDING');
    expect(await subscriptionCount()).toBe(0);
  });
});
