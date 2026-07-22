import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import './setup-env';

describe('Stats integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /stats returns 200 with numeric stats without authentication', async () => {
    const res = await request(app.getHttpServer()).get('/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.availableListings).toBe('number');
    expect(res.body.availableListings).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.verifiedCleanupReports).toBe('number');
    expect(res.body.verifiedCleanupReports).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.scrapWeightKg).toBe('number');
    expect(res.body.scrapWeightKg).toBeGreaterThanOrEqual(0);
  });
});
