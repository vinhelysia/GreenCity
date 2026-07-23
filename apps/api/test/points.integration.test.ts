import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import { PrismaService } from '../src/prisma/prisma.service';
import './setup-env';

describe('Points integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let categoryId: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

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

    const admin = await register('admin');
    adminCookie = admin.cookie;
    await prisma.user.update({
      where: { id: admin.userId },
      data: { roles: ['ADMIN'] },
    });

    const category = await prisma.scrapCategory.create({
      data: {
        name: `Points Test Category ${suffix}`,
        minPricePerKgVnd: 1000,
        maxPricePerKgVnd: 2000,
      },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { contains: `@points-${suffix}.test` } },
      });
      const userIds = users.map((user) => user.id);
      await prisma.pointEntry
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
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
      await prisma.cleanupReport
        .deleteMany({ where: { reporterId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.mediaAsset
        .deleteMany({ where: { ownerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.session
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
      await prisma.scrapCategory
        .deleteMany({ where: { id: categoryId } })
        .catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
  });

  function email(name: string): string {
    return `${name}@points-${suffix}.test`;
  }

  function cookieFrom(response: request.Response): string {
    const raw = response.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (cookies.length === 0) {
      throw new Error('expected Set-Cookie header');
    }
    return cookies[0]!;
  }

  async function register(name: string): Promise<{
    userId: string;
    cookie: string;
  }> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: email(name),
        password: 'password-123',
        displayName: name,
      });
    expect(response.status).toBe(201);
    return { userId: response.body.user.id, cookie: cookieFrom(response) };
  }

  async function createMedia(ownerId: string, name: string): Promise<string> {
    const media = await prisma.mediaAsset.create({
      data: {
        ownerId,
        objectKey: `points-test/${suffix}/${name}`,
        contentType: 'image/png',
        byteSize: 1,
      },
    });
    return media.id;
  }

  async function createReservedListing(
    sellerId: string,
    name: string,
    estimatedWeightKg: number,
    sellerPricePerKgVnd: number,
  ): Promise<string> {
    const mediaAssetId = await createMedia(sellerId, `${name}-listing`);
    const scrapRequest = await prisma.scrapRequest.create({
      data: {
        sellerId,
        categoryId,
        estimatedWeightKg,
        mediaAssetId,
        status: 'ACCEPTED',
      },
    });
    const quote = await prisma.quote.create({
      data: {
        scrapRequestId: scrapRequest.id,
        pricePerKgVnd: sellerPricePerKgVnd,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
    const listing = await prisma.marketplaceListing.create({
      data: {
        quoteId: quote.id,
        scrapRequestId: scrapRequest.id,
        sellerId,
        categoryName: `Points Test Category ${suffix}`,
        estimatedWeightKg,
        sellerPricePerKgVnd,
        buyerPricePerKgVnd: sellerPricePerKgVnd,
        status: 'RESERVED',
        mediaAssetId,
      },
    });
    return listing.id;
  }

  async function createSubmittedReport(
    reporterId: string,
    name: string,
  ): Promise<string> {
    const mediaAssetId = await createMedia(reporterId, `${name}-cleanup`);
    const report = await prisma.cleanupReport.create({
      data: {
        reporterId,
        description: `Cleanup report ${name}`,
        mediaAssetId,
      },
    });
    return report.id;
  }

  async function completeListing(listingId: string) {
    return request(app.getHttpServer())
      .post(`/admin/listings/${listingId}/complete`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
  }

  async function verifyCleanup(reportId: string) {
    return request(app.getHttpServer())
      .post(`/admin/cleanup-reports/${reportId}/verify`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
  }

  it('awards the seller from a RESERVED listing using the configured formula', async () => {
    const seller = await register('listing-award-seller');
    const listingId = await createReservedListing(
      seller.userId,
      'award',
      2.5,
      1500,
    );

    const completed = await completeListing(listingId);
    expect(completed.status).toBe(201);

    const points = await request(app.getHttpServer())
      .get('/points/me')
      .set('Cookie', seller.cookie);
    expect(points.status).toBe(200);
    expect(points.body).toMatchObject({
      balance: 3,
      entries: [{ delta: 3, reason: 'LISTING_COMPLETED' }],
    });
    expect(points.body.entries).toHaveLength(1);
    expect(points.body.entries[0].occurredAt).toEqual(expect.any(String));
  });

  it('rejects completing the same listing twice without a duplicate ledger row', async () => {
    const seller = await register('listing-idempotent-seller');
    const listingId = await createReservedListing(
      seller.userId,
      'idempotent',
      1,
      1000,
    );

    expect((await completeListing(listingId)).status).toBe(201);
    const second = await completeListing(listingId);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('LISTING_NOT_AVAILABLE');
    expect(
      await prisma.pointEntry.count({
        where: { reason: 'LISTING_COMPLETED', referenceId: listingId },
      }),
    ).toBe(1);
  });

  it('awards 50 points to the reporter when a cleanup report is verified', async () => {
    const reporter = await register('cleanup-award-reporter');
    const reportId = await createSubmittedReport(reporter.userId, 'award');

    const verified = await verifyCleanup(reportId);
    expect(verified.status).toBe(201);

    const points = await request(app.getHttpServer())
      .get('/points/me')
      .set('Cookie', reporter.cookie);
    expect(points.status).toBe(200);
    expect(points.body).toMatchObject({
      balance: 50,
      entries: [{ delta: 50, reason: 'CLEANUP_VERIFIED' }],
    });
    expect(points.body.entries).toHaveLength(1);
  });

  it('rejects verifying the same cleanup report twice without a duplicate ledger row', async () => {
    const reporter = await register('cleanup-idempotent-reporter');
    const reportId = await createSubmittedReport(reporter.userId, 'idempotent');

    expect((await verifyCleanup(reportId)).status).toBe(201);
    const second = await verifyCleanup(reportId);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CLEANUP_REPORT_NOT_PENDING');
    expect(
      await prisma.pointEntry.count({
        where: { reason: 'CLEANUP_VERIFIED', referenceId: reportId },
      }),
    ).toBe(1);
  });

  it('returns only the authenticated user points from GET /points/me', async () => {
    const userA = await register('isolation-a');
    const userB = await register('isolation-b');
    const reportId = await createSubmittedReport(userA.userId, 'isolation');
    expect((await verifyCleanup(reportId)).status).toBe(201);

    const pointsA = await request(app.getHttpServer())
      .get('/points/me')
      .set('Cookie', userA.cookie);
    expect(pointsA.body.balance).toBe(50);

    const pointsB = await request(app.getHttpServer())
      .get('/points/me')
      .set('Cookie', userB.cookie);
    expect(pointsB.status).toBe(200);
    expect(pointsB.body).toEqual({ balance: 0, entries: [] });
  });

  it('returns 401 from GET /points/me without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/points/me');
    expect(response.status).toBe(401);
  });
});
