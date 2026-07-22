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

describe('Cleanup report integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  let adminCookie: string;
  let reporterCookie: string;

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

    const adminReg = await register('admin-fixture');
    adminCookie = cookieFrom(adminReg);
    await prisma.user.update({
      where: { email: email('admin-fixture') },
      data: { roles: ['ADMIN'] },
    });

    const reporterReg = await register('reporter-fixture');
    reporterCookie = cookieFrom(reporterReg);
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { contains: `@cleanup-${suffix}.test` } },
      });
      const userIds = users.map((u) => u.id);
      await prisma.cleanupReport
        .deleteMany({ where: { reporterId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.mediaAsset
        .deleteMany({ where: { ownerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
  });

  function email(name: string): string {
    return `${name}@cleanup-${suffix}.test`;
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
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 10, g: 200, b: 10 },
      },
    })
      .png()
      .toBuffer();
    const res = await request(app.getHttpServer())
      .post('/media/upload')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .attach('file', png, { filename: 'dump.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function submitReport(
    description: string,
    location: {
      addressLine?: string;
      ward?: string;
      district?: string;
      city?: string;
    } = {},
  ): Promise<string> {
    const mediaAssetId = await uploadPhoto(reporterCookie);
    const res = await request(app.getHttpServer())
      .post('/cleanup-reports')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', reporterCookie)
      .send({ description, mediaAssetId, ...location });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function reviewReport(id: string, action: 'verify' | 'reject') {
    const res = await request(app.getHttpServer())
      .post(`/admin/cleanup-reports/${id}/${action}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(201);
  }

  it('submits a report with owned photo, lists in mine, and admin verifies it', async () => {
    const mediaId = await uploadPhoto(reporterCookie);

    const submitRes = await request(app.getHttpServer())
      .post('/cleanup-reports')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', reporterCookie)
      .send({
        description: 'Diem rac thai tu phat lon tai khu vuc',
        mediaAssetId: mediaId,
        addressLine: '123 Duong ABC',
        ward: 'Phuong 1',
        district: 'Quan 1',
        city: 'TPHCM',
      });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe('SUBMITTED');
    expect(submitRes.body.description).toBe('Diem rac thai tu phat lon tai khu vuc');
    const reportId = submitRes.body.id;

    const mineRes = await request(app.getHttpServer())
      .get('/cleanup-reports/mine')
      .set('Cookie', reporterCookie);
    expect(mineRes.status).toBe(200);
    const foundMine = mineRes.body.reports.find(
      (r: { id: string }) => r.id === reportId,
    );
    expect(foundMine).toBeTruthy();
    expect(foundMine.status).toBe('SUBMITTED');

    const adminListRes = await request(app.getHttpServer())
      .get('/admin/cleanup-reports?status=SUBMITTED')
      .set('Cookie', adminCookie);
    expect(adminListRes.status).toBe(200);
    const foundAdmin = adminListRes.body.reports.find(
      (r: { id: string }) => r.id === reportId,
    );
    expect(foundAdmin).toBeTruthy();

    const verifyRes = await request(app.getHttpServer())
      .post(`/admin/cleanup-reports/${reportId}/verify`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.status).toBe('VERIFIED');
  });

  it('admin rejects a submitted report', async () => {
    const mediaId = await uploadPhoto(reporterCookie);

    const submitRes = await request(app.getHttpServer())
      .post('/cleanup-reports')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', reporterCookie)
      .send({
        description: 'Bao cao rac gia de test reject',
        mediaAssetId: mediaId,
      });
    expect(submitRes.status).toBe(201);
    const reportId = submitRes.body.id;

    const rejectRes = await request(app.getHttpServer())
      .post(`/admin/cleanup-reports/${reportId}/reject`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.status).toBe('REJECTED');
  });

  it('rejects a non-admin caller on admin verify endpoint with 403', async () => {
    const userReg = await register('plain-user');
    const userCookie = cookieFrom(userReg);

    const res = await request(app.getHttpServer())
      .post('/admin/cleanup-reports/does-not-matter/verify')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userCookie);
    expect(res.status).toBe(403);
  });

  it('rejects a foreign mediaAssetId on submit with 404 MEDIA_NOT_OWNED', async () => {
    const strangerReg = await register('stranger-user');
    const strangerCookie = cookieFrom(strangerReg);
    const strangerMediaId = await uploadPhoto(strangerCookie);

    const res = await request(app.getHttpServer())
      .post('/cleanup-reports')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', reporterCookie)
      .send({
        description: 'Bao cao voi anh cua nguoi khac',
        mediaAssetId: strangerMediaId,
      });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEDIA_NOT_OWNED');
  });

  it('rejects verify on an already verified report with 409 CLEANUP_REPORT_NOT_PENDING', async () => {
    const mediaId = await uploadPhoto(reporterCookie);

    const submitRes = await request(app.getHttpServer())
      .post('/cleanup-reports')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', reporterCookie)
      .send({
        description: 'Bao cao de test verify 2 lan',
        mediaAssetId: mediaId,
      });
    const reportId = submitRes.body.id;

    await request(app.getHttpServer())
      .post(`/admin/cleanup-reports/${reportId}/verify`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);

    const secondVerifyRes = await request(app.getHttpServer())
      .post(`/admin/cleanup-reports/${reportId}/verify`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);
    expect(secondVerifyRes.status).toBe(409);
    expect(secondVerifyRes.body.error.code).toBe('CLEANUP_REPORT_NOT_PENDING');
  });

  it('publicly lists only verified reports with an exact anonymized DTO', async () => {
    const submittedId = await submitReport('Public feed submitted report');
    const verifiedId = await submitReport('Public feed verified report', {
      addressLine: '456 Exact Private Street',
      ward: 'Private Ward',
      district: 'Public District',
      city: 'Public City',
    });
    const rejectedId = await submitReport('Public feed rejected report');
    await reviewReport(verifiedId, 'verify');
    await reviewReport(rejectedId, 'reject');

    const stored = await prisma.cleanupReport.findUniqueOrThrow({
      where: { id: verifiedId },
    });
    expect(stored.reporterId).toBeTruthy();
    expect(stored.addressLine).toBe('456 Exact Private Street');
    expect(stored.ward).toBe('Private Ward');

    const res = await request(app.getHttpServer()).get('/cleanup-reports/public');
    expect(res.status).toBe(200);
    const ids = res.body.reports.map((report: { id: string }) => report.id);
    expect(ids).toContain(verifiedId);
    expect(ids).not.toContain(submittedId);
    expect(ids).not.toContain(rejectedId);

    const report = res.body.reports.find(
      (candidate: { id: string }) => candidate.id === verifiedId,
    );
    expect(Object.keys(report).sort()).toEqual(
      ['city', 'description', 'district', 'id', 'photoPath', 'verifiedAt'].sort(),
    );
    expect(report).toMatchObject({
      id: verifiedId,
      description: 'Public feed verified report',
      city: 'Public City',
      district: 'Public District',
      photoPath: `/cleanup-reports/${verifiedId}/photo`,
    });
    expect(report.verifiedAt).toEqual(expect.any(String));
    expect(report).not.toHaveProperty('reporterId');
    expect(report).not.toHaveProperty('addressLine');
    expect(report).not.toHaveProperty('ward');
    expect(report).not.toHaveProperty('media');
  });

  it('publicly streams photos only for verified reports', async () => {
    const verifiedId = await submitReport('Verified public photo report');
    const submittedId = await submitReport('Submitted private photo report');
    await reviewReport(verifiedId, 'verify');

    const verifiedPhoto = await request(app.getHttpServer()).get(
      `/cleanup-reports/${verifiedId}/photo`,
    );
    expect(verifiedPhoto.status).toBe(200);
    expect(verifiedPhoto.headers['content-type']).toMatch(/^image\//);
    expect(verifiedPhoto.headers['content-length']).toBe(
      String(verifiedPhoto.body.length),
    );
    expect(verifiedPhoto.headers['content-disposition']).toBe('inline');
    expect(verifiedPhoto.headers['x-content-type-options']).toBe('nosniff');
    expect(verifiedPhoto.headers['cache-control']).toBe('public, max-age=300');

    const submittedPhoto = await request(app.getHttpServer()).get(
      `/cleanup-reports/${submittedId}/photo`,
    );
    expect(submittedPhoto.status).toBe(404);
    expect(submittedPhoto.body.error.code).toBe('CLEANUP_REPORT_NOT_FOUND');
  });
});
