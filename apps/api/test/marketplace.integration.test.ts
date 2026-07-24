import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
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
      .post(`/admin/listings/${listingId}/complete`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
    expect(completeRes.status).toBe(201);

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
});
