import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import { requestIdMiddleware } from '../src/common/request-id';
import { PrismaService } from '../src/prisma/prisma.service';
import { processImageUpload } from '../src/media/image-pipeline';
import { assertNoPrivateLocationKeys } from '../src/location/location.redaction';
import './setup-env';

const hasDb = Boolean(process.env.DATABASE_URL);

(hasDb ? describe : describe.skip)('Phase 1 integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
  });

  afterAll(async () => {
    // Cleanup users created in this suite
    if (prisma) {
      await prisma.user
        .deleteMany({
          where: { email: { contains: `@phase1-${suffix}.test` } },
        })
        .catch(() => undefined);
    }
    if (app) {
      await app.close();
    }
  });

  function email(name: string): string {
    return `${name}@phase1-${suffix}.test`;
  }

  function cookieFrom(res: request.Response): string {
    const raw = res.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (list.length === 0) {
      throw new Error('expected Set-Cookie header');
    }
    return list[0]!;
  }

  function cookiesJoined(res: request.Response): string {
    const raw = res.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.join(';');
  }

  async function register(name: string, password = 'password-123') {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: email(name),
        password,
        displayName: name,
      });
    return res;
  }

  it('registers a user and creates a session cookie', async () => {
    const res = await register('alice');
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email('alice'));
    expect(res.body.user.roles).toEqual(['USER']);
    expect(cookiesJoined(res)).toMatch(/gc_session=/);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate email', async () => {
    await register('bob');
    const res = await register('bob');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in successfully and fails generically on bad password', async () => {
    await register('carol', 'secret-pass-99');
    const ok = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: email('carol'), password: 'secret-pass-99' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(email('carol'));

    const bad = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: email('carol'), password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe('Invalid email or password');
  });

  it('GET /auth/me requires session; logout revokes session', async () => {
    const reg = await register('dave');
    const cookie = cookieFrom(reg);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email('dave'));

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const me2 = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie);
    expect(me2.status).toBe(401);
  });

  it('logout-all revokes all sessions', async () => {
    await register('erin', 'logout-all-pass');
    const a = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: email('erin'), password: 'logout-all-pass' });
    const b = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: email('erin'), password: 'logout-all-pass' });
    const cookieA = cookieFrom(a);
    const cookieB = cookieFrom(b);

    const all = await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieA);
    expect(all.status).toBe(200);
    expect(all.body.revoked).toBeGreaterThanOrEqual(1);

    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Cookie', cookieA)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Cookie', cookieB)
      ).status,
    ).toBe(401);
  });

  it('rejects expired and revoked sessions', async () => {
    const reg = await register('frank');
    const cookie = cookieFrom(reg);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: email('frank') },
    });
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions.length).toBeGreaterThan(0);

    await prisma.session.update({
      where: { id: sessions[0]!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Cookie', cookie)
      ).status,
    ).toBe(401);

    // New session then revoke
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: email('frank'), password: 'password-123' });
    const cookie2 = cookieFrom(login);
    const sessions2 = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    await prisma.session.update({
      where: { id: sessions2[0]!.id },
      data: { revokedAt: new Date(), expiresAt: new Date(Date.now() + 3600_000) },
    });
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Cookie', cookie2)
      ).status,
    ).toBe(401);
  });

  it('ignores client role escalation on register', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: email('escalator'),
        password: 'password-123',
        roles: ['ADMIN'],
        status: 'DISABLED',
      });
    // Zod strips unknown keys by default in safeParse - roles/status ignored
    expect(res.status).toBe(201);
    expect(res.body.user.roles).toEqual(['USER']);
    expect(res.body.user.status).toBe('ACTIVE');
  });

  it('rejects invalid Origin on unsafe methods', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: email('alice'), password: 'password-123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ORIGIN');
  });

  it('creates location with exact for owner and public without private keys', async () => {
    const reg = await register('geo');
    const cookie = cookieFrom(reg);

    const created = await request(app.getHttpServer())
      .post('/locations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({
        addressLine: '99 Private Road',
        city: 'Hanoi',
        district: 'Ba Dinh',
        latitude: 21.0285,
        longitude: 105.8542,
      });
    expect(created.status).toBe(201);
    expect(created.body.exact.addressLine).toBe('99 Private Road');
    expect(created.body.exact.latitude).toBeCloseTo(21.0285);

    const publicJson = created.body.public;
    expect(() => assertNoPrivateLocationKeys(publicJson)).not.toThrow();
    expect(JSON.stringify(publicJson)).not.toContain('Private Road');
    expect(JSON.stringify(publicJson)).not.toContain('"latitude"');

    const pubGet = await request(app.getHttpServer())
      .get(`/locations/${created.body.exact.id}/public`)
      .set('Cookie', cookie);
    expect(pubGet.status).toBe(200);
    expect(() => assertNoPrivateLocationKeys(pubGet.body)).not.toThrow();

    // Stranger cannot read exact
    const stranger = await register('stranger');
    const strangerCookie = cookieFrom(stranger);
    const denied = await request(app.getHttpServer())
      .get(`/locations/${created.body.exact.id}/exact`)
      .set('Cookie', strangerCookie);
    expect(denied.status).toBe(403);
  });

  it('uploads image securely, streams content, rejects spoof and paths', async () => {
    const reg = await register('mediauser');
    const cookie = cookieFrom(reg);

    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 20, g: 180, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const up = await request(app.getHttpServer())
      .post('/media/upload')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .attach('file', png, { filename: 'ok.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.downloadPath).toMatch(/^\/media\//);
    expect(JSON.stringify(up.body)).not.toMatch(/file:\/\//);
    expect(JSON.stringify(up.body)).not.toMatch(/C:\\\\|C:\//);
    expect(up.body).not.toHaveProperty('objectKey');

    const content = await request(app.getHttpServer())
      .get(up.body.downloadPath)
      .set('Cookie', cookie);
    expect(content.status).toBe(200);
    expect(content.headers['content-type']).toMatch(/image\//);

    // Unauthorized stranger
    const stranger = await register('mediathief');
    const thiefCookie = cookieFrom(stranger);
    const denied = await request(app.getHttpServer())
      .get(up.body.downloadPath)
      .set('Cookie', thiefCookie);
    expect(denied.status).toBe(403);

    // Spoofed MIME: text as image/jpeg
    const spoof = await request(app.getHttpServer())
      .post('/media/upload')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      });
    expect(spoof.status).toBe(400);

    // Empty / invalid
    const invalid = await request(app.getHttpServer())
      .post('/media/upload')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie);
    expect(invalid.status).toBe(400);
  });
});

describe('image pipeline unit', () => {
  it('strips EXIF/GPS via re-encode', async () => {
    // Minimal JPEG without needing real EXIF library: re-encode path runs and produces clean buffer.
    const jpeg = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg()
      .withMetadata({
        exif: {
          IFD0: { Copyright: 'secret-meta' },
        },
      })
      .toBuffer();

    const processed = await processImageUpload(jpeg, 'image/jpeg');
    expect(processed.contentType).toBe('image/jpeg');
    const meta = await sharp(processed.buffer).metadata();
    // Re-encoded output should not retain original EXIF blob.
    expect(meta.exif).toBeUndefined();
  });

  it('rejects MIME spoof when magic bytes disagree', async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(processImageUpload(png, 'image/jpeg')).rejects.toMatchObject({
      response: { code: 'MIME_MISMATCH' },
    });
  });
});
