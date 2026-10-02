import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GoogleAuthService, GOOGLE_COOKIE } from '../src/auth/google-auth.service';
import { SessionService } from '../src/auth/session.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../src/common/http-exception.filter';
import './setup-env';

describe('Google sign-in HTTP flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let google: GoogleAuthService;
  let verify: jest.SpyInstance;
  const original = { ...process.env };
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const origin = 'http://localhost:3000';
  const email = (name: string) => `${name}@google-${suffix}.test`;
  const cookie = (res: request.Response, name: string) => (res.headers['set-cookie'] as unknown as string[] ?? []).find(value => value.startsWith(`${name}=`))?.split(';')[0] ?? '';

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'http-test.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-only';
    process.env.PUBLIC_WEB_URL = origin;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    google = app.get(GoogleAuthService);
    // Only Google's network boundary is replaced; DB/session/guards/controllers run for real.
    verify = jest.spyOn(google, 'verify');
  });
  afterAll(async () => {
    verify?.mockRestore();
    if (prisma) {
      await prisma.googleOAuthAttempt.deleteMany({ where: { nonce: { startsWith: `test-${suffix}` } } });
      await prisma.user.deleteMany({ where: { email: { endsWith: `@google-${suffix}.test` } } });
    }
    await app?.close();
    process.env = original;
  });
  beforeEach(() => verify.mockReset());

  async function start(returnTo = '/tai-khoan', session?: string) {
    const res = await request(app.getHttpServer()).post(session ? '/auth/google/link' : '/auth/google/start')
      .set('Origin', origin).set('Cookie', session ?? '').send({ returnTo }).expect(200);
    const state = new URL(res.body.url).searchParams.get('state')!;
    // Tag disposable attempts for scoped cleanup; nonce validation is covered by the RSA unit tests.
    await prisma.googleOAuthAttempt.update({ where: { stateHash: app.get(SessionService).hashToken(state) }, data: { nonce: `test-${suffix}-${state}` } });
    return { state, browser: cookie(res, GOOGLE_COOKIE), res };
  }
  function callback(flow: { state: string; browser: string }, session = '', query: Record<string, string> = { code: 'test-code' }) {
    return request(app.getHttpServer()).get('/auth/google/callback').query({ state: flow.state, ...query }).set('Cookie', [flow.browser, session].filter(Boolean).join('; '));
  }
  async function local(name: string) {
    const res = await request(app.getHttpServer()).post('/auth/register').set('Origin', origin)
      .send({ email: email(name), password: 'test-password-123' }).expect(201);
    return { session: cookie(res, 'gc_session'), user: res.body.user };
  }

  it('requires Origin for login start, authentication for linking and exact redirects', async () => {
    await request(app.getHttpServer()).post('/auth/google/start').send({}).expect(403);
    await request(app.getHttpServer()).post('/auth/google/link').set('Origin', origin).send({}).expect(401);
    await request(app.getHttpServer()).post('/auth/google/start').set('Origin', origin).send({ returnTo: '//evil.test' }).expect(400);
  });
  it('disables Google without credentials while local login still works', async () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      const status = await request(app.getHttpServer()).get('/auth/google/status').expect(200);
      expect(status.body).toEqual({ enabled: false, linked: false });
      await request(app.getHttpServer()).post('/auth/google/start').set('Origin', origin).send({}).expect(503);
      await local('disabled-config');
    } finally { process.env.GOOGLE_CLIENT_SECRET = secret; }
  });
  it('creates a Google-only USER, sets an opaque session, restores /me and rejects callback replay', async () => {
    const flow = await start('/en/marketplace');
    expect(flow.res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/);
    expect(flow.res.headers['set-cookie']?.[0]).toMatch(/SameSite=Lax/);
    verify.mockResolvedValue({ subject: `sub-${suffix}`, email: email('new'), displayName: 'Google User' });
    const res = await callback(flow).expect(303);
    expect(res.headers.location).toBe(`${origin}/en/marketplace`);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(res, 'gc_session')).expect(200);
    expect(me.body.user.roles).toEqual(['USER']);
    expect(me.body.user).not.toHaveProperty('googleSubject');
    expect((await prisma.user.findUniqueOrThrow({ where: { email: email('new') } })).passwordHash).toBeNull();
    verify.mockClear();
    expect((await callback(flow).expect(303)).headers.location).toMatch(/googleError=failed/);
    expect(verify).not.toHaveBeenCalled();
  });
  it('does not auto-link an existing email; authenticated linking then Google login use the same user', async () => {
    const account = await local('existing');
    const identity = { subject: `existing-sub-${suffix}`, email: email('existing'), displayName: 'Google' };
    verify.mockResolvedValue(identity);
    const conflict = await callback(await start()).expect(303);
    expect(conflict.headers.location).toMatch(/googleError=link_required/);
    expect(cookie(conflict, 'gc_session')).toBe('');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.user.id } })).googleSubject).toBeNull();
    const linked = await callback(await start('/en/account', account.session), account.session).expect(303);
    expect(linked.headers.location).toBe(`${origin}/en/account?googleLinked=1`);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(linked, 'gc_session')).expect(200);
    expect(me.body.user.id).toBe(account.user.id);
    expect((await request(app.getHttpServer()).get('/auth/google/status').set('Cookie', cookie(linked, 'gc_session')).expect(200)).body.linked).toBe(true);
    const login = await callback(await start()).expect(303);
    expect((await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie(login, 'gc_session')).expect(200)).body.user.id).toBe(account.user.id);
  });
  it('rejects stolen/expired state before verification, cancellation consumes state and no session is created', async () => {
    const flow = await start('/en/account');
    const stolen = await request(app.getHttpServer()).get('/auth/google/callback').query({ state: flow.state, code: 'code' }).expect(303);
    expect(stolen.headers.location).toMatch(/googleError=failed/);
    expect(verify).not.toHaveBeenCalled();
    const cancelled = await callback(flow, '', { error: 'access_denied' }).expect(303);
    expect(cancelled.headers.location).toBe(`${origin}/en/login?googleError=failed`);
    expect(verify).not.toHaveBeenCalled();
    const expired = await start();
    await prisma.googleOAuthAttempt.updateMany({ where: { nonce: { endsWith: expired.state } }, data: { expiresAt: new Date(0) } });
    await callback(expired).expect(303);
    expect(verify).not.toHaveBeenCalled();
  });
  it('refuses disabled Google users, replacement identities and revoked linking sessions', async () => {
    const account = await local('revoked');
    const flow = await start('/tai-khoan', account.session);
    await request(app.getHttpServer()).post('/auth/logout').set('Origin', origin).set('Cookie', account.session).expect(200);
    verify.mockResolvedValue({ subject: `revoked-${suffix}`, email: email('revoked'), displayName: null });
    expect((await callback(flow, account.session).expect(303)).headers.location).toMatch(/googleError=failed/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.user.id } })).googleSubject).toBeNull();
    const replacement = await local('replacement');
    await prisma.user.update({ where: { id: replacement.user.id }, data: { googleSubject: `original-${suffix}` } });
    verify.mockResolvedValue({ subject: `different-${suffix}`, email: email('replacement'), displayName: null });
    expect((await callback(await start('/tai-khoan', replacement.session), replacement.session).expect(303)).headers.location).toMatch(/googleError=failed/);
    await prisma.user.update({ where: { id: replacement.user.id }, data: { status: 'DISABLED' } });
    verify.mockResolvedValue({ subject: `original-${suffix}`, email: email('replacement'), displayName: null });
    const blocked = await callback(await start()).expect(303);
    expect(blocked.headers.location).toMatch(/googleError=failed/);
    expect(cookie(blocked, 'gc_session')).toBe('');
  });
});
