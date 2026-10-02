import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import { PrismaService } from '../src/prisma/prisma.service';
import './setup-env';

describe('Marketplace integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const categoryName = `Marketplace Test Category ${suffix}`;

  let categoryId: string;
  let adminCookie: string;
  let subscribedBuyerCookie: string;
  let subscribedBuyerEmail: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const category = await prisma.scrapCategory.create({
      data: {
        name: categoryName,
        minPricePerKgVnd: 1000,
        maxPricePerKgVnd: 2000,
        active: true,
      },
    });
    categoryId = category.id;

    const adminReg = await register('admin-fixture');
    adminCookie = cookieFrom(adminReg);
    await prisma.user.update({
      where: { email: email('admin-fixture') },
      data: { roles: ['ADMIN'] },
    });

    const buyerReg = await register('buyer-fixture');
    subscribedBuyerCookie = cookieFrom(buyerReg);
    subscribedBuyerEmail = email('buyer-fixture');
    const buyer = await prisma.user.findUniqueOrThrow({
      where: { email: subscribedBuyerEmail },
    });
    await prisma.subscription.create({
      data: {
        userId: buyer.id,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 3600_000),
        note: 'Test subscription',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { contains: `@marketplace-${suffix}.test` } },
      });
      const userIds = users.map((u) => u.id);
      await prisma.reservation
        .deleteMany({ where: { buyerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.marketplaceListing
        .deleteMany({ where: { sellerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.quote
        .deleteMany({ where: { scrapRequest: { sellerId: { in: userIds } } } })
        .catch(() => undefined);
      await prisma.scrapRequest
        .deleteMany({ where: { sellerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.mediaAsset
        .deleteMany({ where: { ownerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.subscription
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
      await prisma.scrapCategory
        .deleteMany({ where: { name: categoryName } })
        .catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
  });

  function email(name: string): string {
    return `${name}@marketplace-${suffix}.test`;
  }

  function cookieFrom(res: request.Response): string {
    const raw = res.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (list.length === 0) {
      throw new Error('expected Set-Cookie header');
    }
    return list[0]!;
  }

  async function register(name: string, password = 'password-123') {
    return request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: email(name), password, displayName: name });
  }

  async function uploadPhoto(cookie: string): Promise<string> {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 200, b: 10 } },
    })
      .png()
      .toBuffer();
    const res = await request(app.getHttpServer())
      .post('/media/upload')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .attach('file', png, { filename: 'scrap.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  /** Builds a full SUBMITTED -> QUOTED -> ACCEPTED -> AVAILABLE listing chain. */
  async function createAvailableListing(prefix: string) {
    const sellerReg = await register(`${prefix}-seller`);
    const sellerCookie = cookieFrom(sellerReg);
    const mediaId = await uploadPhoto(sellerCookie);

    const submitRes = await request(app.getHttpServer())
      .post('/scrap-requests')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie)
      .send({ categoryId, estimatedWeightKg: 2, mediaAssetId: mediaId });
    expect(submitRes.status).toBe(201);
    const scrapRequestId = submitRes.body.id;

    const quoteRes = await request(app.getHttpServer())
      .post(`/admin/scrap-requests/${scrapRequestId}/quote`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ pricePerKgVnd: 1500 });
    expect(quoteRes.status).toBe(201);

    const acceptRes = await request(app.getHttpServer())
      .post(`/scrap-requests/${scrapRequestId}/accept`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie);
    expect(acceptRes.status).toBe(201);

    return {
      listingId: acceptRes.body.listingId as string,
      scrapRequestId: scrapRequestId as string,
      sellerCookie,
    };
  }

  it('full happy path: submit -> admin quote -> accept -> listing visible -> reserve', async () => {
    const sellerReg = await register('happy-seller');
    const sellerCookie = cookieFrom(sellerReg);
    const mediaId = await uploadPhoto(sellerCookie);

    const submitRes = await request(app.getHttpServer())
      .post('/scrap-requests')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie)
      .send({ categoryId, estimatedWeightKg: 4, mediaAssetId: mediaId, note: 'happy path' });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe('SUBMITTED');
    expect(submitRes.body.activeQuote).toBeNull();
    const scrapRequestId = submitRes.body.id;

    const quoteRes = await request(app.getHttpServer())
      .post(`/admin/scrap-requests/${scrapRequestId}/quote`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ pricePerKgVnd: 1500 });
    expect(quoteRes.status).toBe(201);
    expect(quoteRes.body.status).toBe('PENDING');

    const mineRes = await request(app.getHttpServer())
      .get('/scrap-requests/mine')
      .set('Cookie', sellerCookie);
    expect(mineRes.status).toBe(200);
    const mine = mineRes.body.requests.find((r: { id: string }) => r.id === scrapRequestId);
    expect(mine.status).toBe('QUOTED');
    expect(mine.activeQuote.pricePerKgVnd).toBe(1500);

    const acceptRes = await request(app.getHttpServer())
      .post(`/scrap-requests/${scrapRequestId}/accept`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie);
    expect(acceptRes.status).toBe(201);
    const listingId = acceptRes.body.listingId;
    expect(listingId).toBeTruthy();

    // Public, unauthenticated view: isOwn is false, no seller-side price leaks.
    const publicListRes = await request(app.getHttpServer()).get(
      '/marketplace/listings',
    );
    expect(publicListRes.status).toBe(200);
    const publicFound = publicListRes.body.listings.find(
      (l: { id: string }) => l.id === listingId,
    );
    expect(publicFound).toBeTruthy();
    expect(publicFound.buyerPricePerKgVnd).toBe(1500);
    expect(publicFound.estimatedTotalVnd).toBe(6000);
    expect(publicFound.isOwn).toBe(false);
    expect(publicFound).not.toHaveProperty('sellerPricePerKgVnd');
    expect(publicFound).not.toHaveProperty('sellerId');

    // Seller's own session: isOwn is true for the same listing.
    const sellerListRes = await request(app.getHttpServer())
      .get('/marketplace/listings')
      .set('Cookie', sellerCookie);
    const sellerFound = sellerListRes.body.listings.find(
      (l: { id: string }) => l.id === listingId,
    );
    expect(sellerFound.isOwn).toBe(true);

    // Photo is publicly viewable via the listing route, no auth required.
    const photoRes = await request(app.getHttpServer()).get(
      `/marketplace/listings/${listingId}/photo`,
    );
    expect(photoRes.status).toBe(200);
    expect(photoRes.headers['content-type']).toMatch(/image\//);

    const reserveRes = await request(app.getHttpServer())
      .post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', subscribedBuyerCookie);
    expect(reserveRes.status).toBe(201);

    const reservedPhoto = await request(app.getHttpServer()).get(
      `/marketplace/listings/${listingId}/photo`,
    );
    expect(reservedPhoto.status).toBe(404);
    expect(reservedPhoto.body.error.code).toBe('LISTING_NOT_AVAILABLE');

    // The admin queue is the only way to reach a reserved listing from the UI:
    // it never appears in the buyer-facing browse, so completing a sale would
    // otherwise be unreachable outside a hand-written request.
    const queued = await request(app.getHttpServer())
      .get('/admin/listings?status=RESERVED')
      .set('Cookie', adminCookie);
    expect(queued.status).toBe(200);
    expect(
      queued.body.listings.some((l: { id: string }) => l.id === listingId),
    ).toBe(true);

    const completeRes = await request(app.getHttpServer())
      .post(`/admin/reservations/${reserveRes.body.reservationId}/complete`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ actualWeightKg: 3, sellerReceivedAmountVnd: 4500, receiptNote: 'Cash receipt TEST-001' });
    expect(completeRes.status).toBe(201);
    const listing = await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listingId } });
    const earned = await prisma.pointEntry.findUniqueOrThrow({ where: { reason_referenceId: { reason: 'LISTING_COMPLETED', referenceId: listingId } } });
    expect(earned.delta).toBe(4); // Actual 4,500 VND, rather than the 6,000 VND estimate.
    expect(listing.status).toBe('COMPLETED');

    const queuedAfter = await request(app.getHttpServer())
      .get('/admin/listings?status=RESERVED')
      .set('Cookie', adminCookie);
    expect(
      queuedAfter.body.listings.some((l: { id: string }) => l.id === listingId),
    ).toBe(false);

    const gone = await request(app.getHttpServer()).get('/marketplace/listings');
    expect(
      gone.body.listings.some((l: { id: string }) => l.id === listingId),
    ).toBe(false);
  });

  it('rejects a non-admin caller on the admin listings queue with 403', async () => {
    const userReg = await register('plain-user-listings');
    const res = await request(app.getHttpServer())
      .get('/admin/listings?status=RESERVED')
      .set('Cookie', cookieFrom(userReg));
    expect(res.status).toBe(403);
  });

  it('rejects a non-admin caller on the admin quote endpoint with 403', async () => {
    const userReg = await register('plain-user');
    const userCookie = cookieFrom(userReg);

    const res = await request(app.getHttpServer())
      .post('/admin/scrap-requests/does-not-matter/quote')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userCookie)
      .send({ pricePerKgVnd: 1200 });
    expect(res.status).toBe(403);
  });

  it('rejects an unsubscribed buyer reserving a listing with SUBSCRIPTION_REQUIRED', async () => {
    const { listingId } = await createAvailableListing('unsub');
    const unsubReg = await register('unsub-buyer');
    const unsubCookie = cookieFrom(unsubReg);

    const res = await request(app.getHttpServer())
      .post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', unsubCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('rejects a seller reserving their own listing with CANNOT_RESERVE_OWN_LISTING', async () => {
    const { listingId, sellerCookie } = await createAvailableListing('ownlisting');
    // Give the seller their own subscription so the rejection is specifically
    // about ownership, not eligibility.
    const seller = await prisma.user.findUniqueOrThrow({
      where: { email: email('ownlisting-seller') },
    });
    await prisma.subscription.create({
      data: {
        userId: seller.id,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 3600_000),
        note: 'Test subscription',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CANNOT_RESERVE_OWN_LISTING');
  });

  it('resolves two concurrent reserve calls to exactly one 201 and one 409', async () => {
    const { listingId } = await createAvailableListing('concurrency');

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/marketplace/listings/${listingId}/reserve`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', subscribedBuyerCookie),
      request(app.getHttpServer())
        .post(`/marketplace/listings/${listingId}/reserve`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', subscribedBuyerCookie),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('LISTING_NOT_AVAILABLE');

    const reservations = await prisma.reservation.findMany({
      where: { listingId },
    });
    expect(reservations.length).toBe(1);
  });

  it('rejects a foreign mediaAssetId on submit with 404 MEDIA_NOT_OWNED', async () => {
    const sellerReg = await register('foreign-media-seller');
    const sellerCookie = cookieFrom(sellerReg);
    const strangerReg = await register('foreign-media-stranger');
    const strangerCookie = cookieFrom(strangerReg);
    const strangerMediaId = await uploadPhoto(strangerCookie);

    const res = await request(app.getHttpServer())
      .post('/scrap-requests')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie)
      .send({ categoryId, estimatedWeightKg: 2, mediaAssetId: strangerMediaId });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEDIA_NOT_OWNED');

    const missingRes = await request(app.getHttpServer())
      .post('/scrap-requests')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie)
      .send({ categoryId, estimatedWeightKg: 2, mediaAssetId: 'does-not-exist' });
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.error.code).toBe('MEDIA_NOT_OWNED');
  });

  it('supersedes the prior quote when a second quote is issued', async () => {
    const sellerReg = await register('supersede-seller');
    const sellerCookie = cookieFrom(sellerReg);
    const mediaId = await uploadPhoto(sellerCookie);

    const submitRes = await request(app.getHttpServer())
      .post('/scrap-requests')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sellerCookie)
      .send({ categoryId, estimatedWeightKg: 2, mediaAssetId: mediaId });
    const scrapRequestId = submitRes.body.id;

    const firstQuote = await request(app.getHttpServer())
      .post(`/admin/scrap-requests/${scrapRequestId}/quote`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ pricePerKgVnd: 1200 });
    expect(firstQuote.status).toBe(201);

    const secondQuote = await request(app.getHttpServer())
      .post(`/admin/scrap-requests/${scrapRequestId}/quote`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ pricePerKgVnd: 1600 });
    expect(secondQuote.status).toBe(201);

    const persistedFirst = await prisma.quote.findUnique({
      where: { id: firstQuote.body.id },
    });
    expect(persistedFirst?.status).toBe('SUPERSEDED');

    const persistedSecond = await prisma.quote.findUnique({
      where: { id: secondQuote.body.id },
    });
    expect(persistedSecond?.status).toBe('PENDING');

    const persistedRequest = await prisma.scrapRequest.findUnique({
      where: { id: scrapRequestId },
    });
    expect(persistedRequest?.status).toBe('QUOTED');
  });

  describe('POST /admin/subscriptions', () => {
    function grant(cookie: string, body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post('/admin/subscriptions')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', cookie)
        .send(body);
    }

    it('turns SUBSCRIPTION_REQUIRED into a successful reserve', async () => {
      // The reason this endpoint exists: payOS has never run against a real
      // merchant account, so before this the pass could not be obtained and
      // reserving was unreachable for any account that was not seeded.
      const { listingId } = await createAvailableListing('granted');
      const buyerReg = await register('granted-buyer');
      const buyerCookie = cookieFrom(buyerReg);

      const blocked = await request(app.getHttpServer())
        .post(`/marketplace/listings/${listingId}/reserve`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', buyerCookie);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('SUBSCRIPTION_REQUIRED');

      const granted = await grant(adminCookie, {
        email: email('granted-buyer'),
        durationDays: 30,
        note: 'Contest demo reviewer',
      });
      expect(granted.status).toBe(201);
      expect(granted.body.subscription.status).toBe('ACTIVE');
      expect(granted.body.subscription.note).toBe('Contest demo reviewer');
      expect(granted.body.userEmail).toBe(email('granted-buyer'));

      const reserved = await request(app.getHttpServer())
        .post(`/marketplace/listings/${listingId}/reserve`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', buyerCookie);
      expect(reserved.status).toBe(201);
    });

    it('creates no payment row — a grant is eligibility, not money received', async () => {
      const reg = await register('nopay-buyer');
      expect(cookieFrom(reg)).toBeTruthy();
      const res = await grant(adminCookie, {
        email: email('nopay-buyer'),
        durationDays: 7,
        note: 'Eligibility only',
      });
      expect(res.status).toBe(201);

      const payments = await prisma.subscriptionPayment.count({
        where: { subscriptionId: res.body.subscription.id },
      });
      expect(payments).toBe(0);
    });

    it('records the granting admin in the audit log', async () => {
      const reg = await register('audited-buyer');
      expect(cookieFrom(reg)).toBeTruthy();
      const res = await grant(adminCookie, {
        email: email('audited-buyer'),
        durationDays: 30,
        note: 'Audit trail check',
      });
      expect(res.status).toBe(201);

      const entry = await prisma.auditLog.findFirst({
        where: {
          action: 'subscription.grant',
          targetId: res.body.subscription.id,
        },
      });
      expect(entry).not.toBeNull();
      expect(entry?.actorId).toBeTruthy();
      expect(entry?.targetType).toBe('Subscription');
    });

    it('refuses a second grant while a pass is still active', async () => {
      const reg = await register('double-buyer');
      expect(cookieFrom(reg)).toBeTruthy();
      expect(
        (
          await grant(adminCookie, {
            email: email('double-buyer'),
            durationDays: 30,
            note: 'First',
          })
        ).status,
      ).toBe(201);

      const second = await grant(adminCookie, {
        email: email('double-buyer'),
        durationDays: 30,
        note: 'Second',
      });
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('SUBSCRIPTION_ALREADY_ACTIVE');
    });

    it('returns USER_NOT_FOUND for an email with no account', async () => {
      const res = await grant(adminCookie, {
        email: `nobody-${suffix}@example.test`,
        durationDays: 30,
        note: 'Nobody',
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('rejects a grant with no reason and one longer than a year', async () => {
      const reg = await register('invalid-grant-buyer');
      expect(cookieFrom(reg)).toBeTruthy();
      const target = email('invalid-grant-buyer');

      expect(
        (await grant(adminCookie, { email: target, note: '   ' })).status,
      ).toBe(400);
      expect(
        (
          await grant(adminCookie, {
            email: target,
            durationDays: 400,
            note: 'Too long',
          })
        ).status,
      ).toBe(400);
    });

    it('rejects a non-admin caller with 403', async () => {
      const userReg = await register('grant-nonadmin');
      const res = await grant(cookieFrom(userReg), {
        email: email('grant-nonadmin'),
        durationDays: 30,
        note: 'Self service',
      });
      expect(res.status).toBe(403);
    });
  });

  function reservationAction(id: string, action: string, body: object, cookie = adminCookie) {
    return request(app.getHttpServer()).post(`/admin/reservations/${id}/${action}`)
      .set('Origin', 'http://localhost:3000').set('Cookie', cookie).send(body);
  }

  const settlement = { actualWeightKg: 1.5, sellerReceivedAmountVnd: 2250, receiptNote: 'Cash receipt COLLECTION-001' };

  it('keeps cancelled history, restricts private details, and allows a new buyer to reserve again', async () => {
    const { listingId, sellerCookie } = await createAvailableListing('collection');
    const reserve = await request(app.getHttpServer()).post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000').set('Cookie', subscribedBuyerCookie);
    const id = reserve.body.reservationId;
    expect(reserve.status).toBe(201);
    const detail = (cookie: string) => request(app.getHttpServer()).get(`/marketplace/reservations/${id}`).set('Cookie', cookie);
    expect((await request(app.getHttpServer()).get(`/marketplace/reservations/${id}`)).status).toBe(401);
    const outsider = cookieFrom(await register('collection-outsider'));
    expect((await detail(outsider)).status).toBe(404);
    for (const cookie of [sellerCookie, subscribedBuyerCookie]) {
      const own = await detail(cookie);
      expect(own.status).toBe(200);
      expect(own.headers['cache-control']).toBe('private, no-store');
      expect(own.body.contacts).toBeNull();
      expect(own.body.scheduledAt).toBeNull();
    }
    expect((await detail(adminCookie)).body.contacts.buyer.email).toBe(subscribedBuyerEmail);
    const schedule = { scheduledAt: '2026-11-01T08:00:00+07:00', pickupLocation: 'Campus collection point', coordinatorContact: 'Coordinator: 0900000000' };
    for (const [action, body] of [['schedule', schedule], ['cancel', { reason: 'Buyer unavailable' }], ['complete', settlement]] as const) {
      expect((await reservationAction(id, action, body, subscribedBuyerCookie)).status).toBe(403);
    }
    expect((await reservationAction(id, 'schedule', schedule)).status).toBe(201);
    expect((await detail(sellerCookie)).body).toMatchObject({ ...schedule, scheduledAt: '2026-11-01T01:00:00.000Z' });
    expect((await reservationAction(id, 'complete', {})).status).toBe(400);
    expect((await reservationAction(id, 'complete', { ...settlement, sellerReceivedAmountVnd: -1 })).status).toBe(400);
    expect((await reservationAction(id, 'cancel', { reason: ' ' })).status).toBe(400);
    expect((await reservationAction(id, 'cancel', { reason: 'Buyer unavailable' })).status).toBe(201);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id } }))).toMatchObject({ status: 'CANCELLED', cancelledById: expect.any(String) });
    expect((await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe('AVAILABLE');
    const nextCookie = cookieFrom(await register('collection-next-buyer'));
    expect((await reservationAction(id, 'complete', settlement)).status).toBe(409);
    await request(app.getHttpServer()).post('/admin/subscriptions').set('Origin', 'http://localhost:3000').set('Cookie', adminCookie)
      .send({ email: email('collection-next-buyer'), note: 'Collection rebooking test' }).expect(201);
    const next = await request(app.getHttpServer()).post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000').set('Cookie', nextCookie);
    expect(next.status).toBe(201);
    expect(next.body.reservationId).not.toBe(id);
    expect((await reservationAction(id, 'complete', settlement)).status).toBe(409);
    expect((await request(app.getHttpServer()).get(`/marketplace/reservations/${next.body.reservationId}`).set('Cookie', subscribedBuyerCookie)).status).toBe(404);
    const oldHistory = await request(app.getHttpServer()).get('/account/history?limit=10').set('Cookie', subscribedBuyerCookie);
    expect(oldHistory.body.reservations.find((r: { id: string }) => r.id === id)).toMatchObject({ status: 'CANCELLED', role: 'BUYER' });
    const sellerHistory = await request(app.getHttpServer()).get('/account/history').set('Cookie', sellerCookie);
    expect(sellerHistory.body.reservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id, status: 'CANCELLED', role: 'SELLER' }),
      expect.objectContaining({ id: next.body.reservationId, status: 'RESERVED', role: 'SELLER' }),
    ]));
    const active = await prisma.reservation.findUniqueOrThrow({ where: { id: next.body.reservationId } });
    await expect(prisma.reservation.create({ data: { listingId, buyerId: active.buyerId } })).rejects.toMatchObject({ code: 'P2002' });
    expect((await reservationAction(active.id, 'complete', settlement)).status).toBe(201);
    expect((await request(app.getHttpServer()).get(`/marketplace/reservations/${active.id}`).set('Cookie', sellerCookie)).body).toMatchObject({ status: 'COMPLETED', ...settlement, contacts: null });
    const point = await prisma.pointEntry.findUniqueOrThrow({ where: { reason_referenceId: { reason: 'LISTING_COMPLETED', referenceId: listingId } } });
    expect(point.delta).toBe(2);
    expect((await prisma.auditLog.findMany({ where: { targetId: active.id, action: 'reservation.complete' } }))).toHaveLength(1);
  });

  it('serializes competing cancel/complete operations and never rewards a cancelled reservation', async () => {
    const { listingId } = await createAvailableListing('collection-race');
    const reserved = await request(app.getHttpServer()).post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000').set('Cookie', subscribedBuyerCookie);
    const id = reserved.body.reservationId;
    const results = await Promise.all([
      reservationAction(id, 'complete', settlement),
      reservationAction(id, 'cancel', { reason: 'Cancelled while completing' }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id } });
    const listing = await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe(row.status === 'COMPLETED' ? 'COMPLETED' : 'AVAILABLE');
    expect(await prisma.pointEntry.count({ where: { referenceId: listingId, reason: 'LISTING_COMPLETED' } })).toBe(row.status === 'COMPLETED' ? 1 : 0);
    expect((await reservationAction(id, 'schedule', { scheduledAt: '2026-11-02T01:00:00Z', pickupLocation: 'Campus', coordinatorContact: 'Admin' })).status).toBe(409);
  });

  it('rolls back settlement and listing state if the points ledger write fails', async () => {
    const { listingId } = await createAvailableListing('collection-rollback');
    const reserved = await request(app.getHttpServer()).post(`/marketplace/listings/${listingId}/reserve`)
      .set('Origin', 'http://localhost:3000').set('Cookie', subscribedBuyerCookie);
    const listing = await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listingId } });
    await prisma.pointEntry.create({ data: { userId: listing.sellerId, reason: 'LISTING_COMPLETED', referenceId: listingId, delta: 1 } });
    expect((await reservationAction(reserved.body.reservationId, 'complete', settlement)).status).toBe(500);
    expect((await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe('RESERVED');
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reserved.body.reservationId } }))).toMatchObject({ status: 'RESERVED', completedAt: null, sellerReceivedAmountVnd: null });
  });

  it('backfills historical outcomes without inventing settlement data', async () => {
    const schema = `collection_migration_${suffix.replace(/[^a-z0-9]/g, '')}`;
    const migration = readFileSync(path.join(__dirname, '../prisma/migrations/20261002000001_reservation_collection_flow/migration.sql'), 'utf8');
    // Only trusted migration SQL and a locally generated identifier are used.
    // A forced rollback leaves this isolated test schema and fixture rows absent.
    const rollback = new Error('rollback migration fixture');
    try {
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe('CREATE TABLE "MarketplaceListing" (id TEXT PRIMARY KEY, status TEXT NOT NULL)');
        await tx.$executeRawUnsafe('CREATE TABLE "Reservation" (id TEXT PRIMARY KEY, "listingId" TEXT NOT NULL)');
        await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "Reservation_listingId_key" ON "Reservation"("listingId")');
        await tx.$executeRawUnsafe(`INSERT INTO "MarketplaceListing" VALUES ('a','RESERVED'),('b','COMPLETED'),('c','CANCELLED'),('d','AVAILABLE')`);
        await tx.$executeRawUnsafe(`INSERT INTO "Reservation" VALUES ('r-a','a'),('r-b','b'),('r-c','c'),('r-d','d')`);
        for (const statement of migration.split(';')) {
          const sql = statement.replace(/--[^\n]*/g, '').trim();
          if (sql && sql !== 'BEGIN' && sql !== 'COMMIT') await tx.$executeRawUnsafe(sql);
        }
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; status: string; actualWeightKg: number | null; sellerReceivedAmountVnd: number | null }>>('SELECT id,status,"actualWeightKg","sellerReceivedAmountVnd" FROM "Reservation" ORDER BY id');
        expect(rows.map(r => r.status)).toEqual(['RESERVED', 'COMPLETED', 'CANCELLED', 'CANCELLED']);
        expect(rows.every(r => r.actualWeightKg === null && r.sellerReceivedAmountVnd === null)).toBe(true);
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
