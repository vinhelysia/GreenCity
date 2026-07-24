import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import { PrismaService } from '../src/prisma/prisma.service';
import './setup-env';

/**
 * Checkout over real HTTP against the real AppModule, with the provider stubbed.
 * Nothing here contacts MoMo.
 *
 * The MoMo settings live in process.env rather than a fixture because the
 * service reads them through loadEnv() on every call, which is what lets a test
 * take them away again and observe PAYMENT_NOT_CONFIGURED.
 */
describe('Subscription checkout integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const ORIGIN = 'http://localhost:3000';
  const PARTNER_CODE = 'GCTESTPARTNER';

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

  /** Captured provider requests, so a test can assert what the server sent. */
  let sentBodies: Array<Record<string, unknown>>;

  function configureMomo(): void {
    process.env.MOMO_ENV = 'sandbox';
    process.env.MOMO_PARTNER_CODE = PARTNER_CODE;
    process.env.MOMO_ACCESS_KEY = 'test-access-key';
    process.env.MOMO_SECRET_KEY = 'test-secret-not-a-credential';
    process.env.PUBLIC_API_URL = 'https://api.example.test';
    process.env.PUBLIC_WEB_URL = 'https://web.example.test';
  }

  function unconfigureMomo(): void {
    for (const key of MOMO_ENV_KEYS) delete process.env[key];
  }

  /**
   * Replies the way MoMo would, echoing back whatever the server generated.
   * Reading the ids off the captured request is deliberate: hard-coding them in
   * both the service and the test would let a wrong id pass unnoticed.
   */
  function stubProvider(
    reply: (body: Record<string, unknown>) => Promise<Response> | Response,
  ): void {
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sentBodies.push(body);
      return reply(body);
    }) as unknown as typeof fetch;
  }

  function providerSuccess(overrides: Record<string, unknown> = {}) {
    return (body: Record<string, unknown>) =>
      new Response(
        JSON.stringify({
          partnerCode: body.partnerCode,
          orderId: body.orderId,
          requestId: body.requestId,
          amount: body.amount,
          resultCode: 0,
          message: 'Successful.',
          payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?t=abc123',
          ...overrides,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
  }

  function email(name: string): string {
    return `${name}@checkout-${suffix}.test`;
  }

  function cookieFrom(response: request.Response): string {
    const raw = response.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (cookies.length === 0) throw new Error('expected Set-Cookie header');
    return cookies[0]!;
  }

  async function register(
    name: string,
  ): Promise<{ userId: string; cookie: string }> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', ORIGIN)
      .send({ email: email(name), password: 'password-123', displayName: name });
    expect(response.status).toBe(201);
    return { userId: response.body.user.id, cookie: cookieFrom(response) };
  }

  function postCheckout(cookie: string, body: unknown = {}) {
    return request(app.getHttpServer())
      .post('/subscription-payments')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body as object);
  }

  let buyer: { userId: string; cookie: string };
  let stranger: { userId: string; cookie: string };

  /**
   * Always scoped to this suite's users. The integration lane shares one
   * database, so an unfiltered count also sees rows the activation suite is
   * creating alongside us and the assertion becomes order-dependent.
   */
  function paymentCount(): Promise<number> {
    return prisma.subscriptionPayment.count({
      where: { userId: { in: [buyer.userId, stranger.userId] } },
    });
  }

  beforeAll(async () => {
    for (const key of MOMO_ENV_KEYS) originalEnv[key] = process.env[key];

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    buyer = await register('buyer');
    stranger = await register('stranger');
  });

  afterAll(async () => {
    // The integration lane shares one process and one database, so both the
    // patched global and the mutated env have to go back exactly as they were.
    globalThis.fetch = originalFetch;
    for (const key of MOMO_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    if (prisma) {
      const userIds = [buyer?.userId, stranger?.userId].filter(
        Boolean,
      ) as string[];
      await prisma.subscriptionPayment
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.subscription
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.auditLog
        .deleteMany({ where: { actorId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.session
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    sentBodies = [];
    configureMomo();
    globalThis.fetch = originalFetch;
    await prisma.subscriptionPayment.deleteMany({
      where: { userId: { in: [buyer.userId, stranger.userId] } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: [buyer.userId, stranger.userId] } },
    });
  });

  // ── access control ────────────────────────────────────────────────────────

  it('rejects an unauthenticated POST', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscription-payments')
      .set('Origin', ORIGIN)
      .send({});
    expect(res.status).toBe(401);
    expect(await paymentCount()).toBe(0);
  });

  it('rejects an authenticated POST with no Origin header', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscription-payments')
      .set('Cookie', buyer.cookie)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ORIGIN');
    expect(await paymentCount()).toBe(0);
  });

  it('accepts an authenticated POST from an allowed Origin', async () => {
    stubProvider(providerSuccess());
    const res = await postCheckout(buyer.cookie);
    expect(res.status).toBe(201);
  });

  // ── the client cannot price itself ────────────────────────────────────────

  it.each([
    ['amount', { amount: 1 }],
    ['amountVnd', { amountVnd: 1 }],
    ['duration', { duration: 3650 }],
    ['durationDays', { durationDays: 3650 }],
  ])('rejects a body carrying %s and creates no payment', async (_l, body) => {
    stubProvider(providerSuccess());
    const res = await postCheckout(buyer.cookie, body);

    expect(res.status).toBe(400);
    expect(await paymentCount()).toBe(0);
    expect(sentBodies).toHaveLength(0);
  });

  it('stores exactly the server plan: 50000 VND for 30 days', async () => {
    stubProvider(providerSuccess());
    const res = await postCheckout(buyer.cookie);

    const row = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: res.body.paymentId },
    });
    expect(row.amountVnd).toBe(50000);
    expect(row.durationDays).toBe(30);
    expect(sentBodies[0]!.amount).toBe(50000);
  });

  // ── configuration ─────────────────────────────────────────────────────────

  it.each([
    ['no configuration at all', () => unconfigureMomo()],
    [
      'partial configuration',
      () => {
        delete process.env.MOMO_SECRET_KEY;
      },
    ],
  ])(
    'returns PAYMENT_NOT_CONFIGURED with %s and creates no payment',
    async (_l, breakConfig) => {
      breakConfig();
      stubProvider(providerSuccess());

      const res = await postCheckout(buyer.cookie);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');
      // The message must not name the absent key.
      expect(JSON.stringify(res.body)).not.toMatch(/SECRET|ACCESS|PARTNER/i);
      expect(await paymentCount()).toBe(0);
      expect(sentBodies).toHaveLength(0);
    },
  );

  // ── ordering and generated identifiers ────────────────────────────────────

  it('writes the PENDING row before the provider is called', async () => {
    let pendingAtCallTime = -1;
    stubProvider(async (body) => {
      pendingAtCallTime = await prisma.subscriptionPayment.count({
        where: { userId: buyer.userId, status: 'PENDING' },
      });
      return providerSuccess()(body);
    });

    await postCheckout(buyer.cookie);
    expect(pendingAtCallTime).toBe(1);
  });

  it('generates its own unique orderId/requestId, ignoring any the client sends', async () => {
    stubProvider(providerSuccess());
    const first = await postCheckout(buyer.cookie);
    const second = await postCheckout(buyer.cookie);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const [a, b] = sentBodies;
    expect(a!.orderId).not.toBe(b!.orderId);
    expect(a!.requestId).not.toBe(b!.requestId);
    // Nothing identifying the user may travel to the provider as an id.
    expect(String(a!.orderId)).not.toContain(buyer.userId);
    expect(String(a!.orderId)).not.toContain('@');

    // And an id supplied by the browser is not honoured.
    const forged = await postCheckout(buyer.cookie, {
      orderId: 'ATTACKER',
      requestId: 'ATTACKER',
    });
    expect(forged.status).toBe(400);
  });

  // ── success shape, and what success does NOT do ───────────────────────────

  it('returns only paymentId and payUrl', async () => {
    stubProvider(providerSuccess());
    const res = await postCheckout(buyer.cookie);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['payUrl', 'paymentId']);
    expect(res.body.payUrl).toMatch(/^https:\/\/test-payment\.momo\.vn\//);
  });

  it('creates no Subscription: only a verified IPN grants access', async () => {
    stubProvider(providerSuccess());
    await postCheckout(buyer.cookie);

    expect(
      await prisma.subscription.count({ where: { userId: buyer.userId } }),
    ).toBe(0);
    const me = await request(app.getHttpServer())
      .get('/subscriptions/me')
      .set('Cookie', buyer.cookie);
    expect(me.body.eligible).toBe(false);
  });

  // ── provider failures ─────────────────────────────────────────────────────

  it.each([
    [
      'a transport failure',
      () => {
        throw new Error('socket hang up');
      },
    ],
    [
      'a timeout',
      () => {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      },
    ],
    ['malformed JSON', () => new Response('<html>', { status: 200 })],
  ])(
    'leaves the payment PENDING after %s',
    async (_label, reply: () => Response) => {
      stubProvider(reply);

      const res = await postCheckout(buyer.cookie);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');

      // The row survives, still PENDING: the call is ambiguous and a valid IPN
      // may still arrive. Deleting it or failing it would lose that payment.
      const rows = await prisma.subscriptionPayment.findMany({
        where: { userId: buyer.userId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe('PENDING');
      expect(
        await prisma.subscription.count({ where: { userId: buyer.userId } }),
      ).toBe(0);
    },
  );

  it('maps a provider rejection to PAYMENT_PROVIDER_REJECTED without granting access', async () => {
    stubProvider(providerSuccess({ resultCode: 99, payUrl: undefined }));

    const res = await postCheckout(buyer.cookie);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_REJECTED');
    expect(
      await prisma.subscription.count({ where: { userId: buyer.userId } }),
    ).toBe(0);
  });

  // ── owner-only status ─────────────────────────────────────────────────────

  it('lets the owner read their payment, exposing no internal fields', async () => {
    stubProvider(providerSuccess());
    const created = await postCheckout(buyer.cookie);

    const res = await request(app.getHttpServer())
      .get(`/subscription-payments/${created.body.paymentId}`)
      .set('Cookie', buyer.cookie);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'amountVnd',
      'id',
      'paidAt',
      'status',
    ]);
    expect(res.body).toMatchObject({ status: 'PENDING', amountVnd: 50000 });
    expect(res.body.paidAt).toBeNull();

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(buyer.userId);
    expect(serialized.toLowerCase()).not.toContain('momo');
  });

  it('gives another user and a nonexistent id the identical PAYMENT_NOT_FOUND', async () => {
    stubProvider(providerSuccess());
    const created = await postCheckout(buyer.cookie);

    const foreign = await request(app.getHttpServer())
      .get(`/subscription-payments/${created.body.paymentId}`)
      .set('Cookie', stranger.cookie);
    const missing = await request(app.getHttpServer())
      .get('/subscription-payments/does-not-exist')
      .set('Cookie', stranger.cookie);

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.error.code).toBe('PAYMENT_NOT_FOUND');
    // Indistinguishable: otherwise the 404 leaks that the id exists.
    expect(foreign.body.error.message).toBe(missing.body.error.message);
  });

  // ── checkout availability ─────────────────────────────────────────────────

  it('reports checkoutAvailable=true when the configuration is complete', async () => {
    const res = await request(app.getHttpServer())
      .get('/subscriptions/me')
      .set('Cookie', buyer.cookie);
    expect(res.status).toBe(200);
    expect(res.body.checkoutAvailable).toBe(true);
  });

  it.each([
    ['missing', () => unconfigureMomo()],
    [
      'partial',
      () => {
        delete process.env.MOMO_ACCESS_KEY;
      },
    ],
  ])(
    'reports checkoutAvailable=false with %s configuration, naming nothing',
    async (_l, breakConfig) => {
      breakConfig();
      const res = await request(app.getHttpServer())
        .get('/subscriptions/me')
        .set('Cookie', buyer.cookie);

      expect(res.status).toBe(200);
      expect(res.body.checkoutAvailable).toBe(false);
      expect(JSON.stringify(res.body)).not.toMatch(/MOMO|SECRET|ACCESS/i);
    },
  );

  // ── audit ─────────────────────────────────────────────────────────────────

  it('audits the creation with the plan only, and no provider data', async () => {
    stubProvider(providerSuccess());
    const created = await postCheckout(buyer.cookie);

    const entry = await prisma.auditLog.findFirst({
      where: {
        actorId: buyer.userId,
        action: 'subscription_payment.create',
        targetId: created.body.paymentId,
      },
    });
    expect(entry).not.toBeNull();
    expect(entry!.metadata).toEqual({ amountVnd: 50000, durationDays: 30 });

    const serialized = JSON.stringify(entry);
    for (const forbidden of [
      'test-secret-not-a-credential',
      'test-payment.momo.vn',
      String(sentBodies[0]!.signature),
      String(sentBodies[0]!.orderId),
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
