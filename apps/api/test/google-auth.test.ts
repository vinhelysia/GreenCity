import { generateKeyPairSync, createSign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuthService } from '../src/auth/google-auth.service';
import { SessionService } from '../src/auth/session.service';
import { GoogleOAuthStartSchema, GoogleOAuthUrlSchema } from '@greencity/shared';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const clientId = 'test.apps.googleusercontent.com';
const original = { ...process.env };
const claims = () => ({ iss: 'https://accounts.google.com', aud: clientId, azp: clientId,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  sub: 'google-subject', email: 'google@example.com', email_verified: true, nonce: 'nonce' });
function signed(payload: Record<string, unknown>) {
  const data = [JSON.stringify({ alg: 'RS256', kid: 'test' }), JSON.stringify(payload)].map(value => Buffer.from(value).toString('base64url')).join('.');
  return `${data}.${createSign('RSA-SHA256').update(data).sign(keys.privateKey, 'base64url')}`;
}

describe('Google OAuth security', () => {
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock; updateMany: jest.Mock }; googleOAuthAttempt: { create: jest.Mock; findFirst: jest.Mock; deleteMany: jest.Mock } };
  let sessions: SessionService;
  let service: GoogleAuthService;
  const createSession = jest.fn();
  const resolveActiveSession = jest.fn();
  const record = jest.fn();

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = clientId;
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.PUBLIC_WEB_URL = 'https://green-city-web.vercel.app';
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      googleOAuthAttempt: { create: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    sessions = new SessionService({} as never);
    sessions.createSession = createSession.mockResolvedValue({ rawToken: 'fresh-session' });
    sessions.resolveActiveSession = resolveActiveSession;
    service = new GoogleAuthService(prisma as never, sessions, { record } as never);
    jest.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
      certs: { test: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString() }, format: 'PEM',
    } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); process.env = { ...original }; });

  it('creates PKCE, nonce and browser-bound state without persisting raw state/cookie', async () => {
    const result = await service.start('/en/marketplace');
    const url = new URL(result.url);
    const data = prisma.googleOAuthAttempt.create.mock.calls[0][0].data;
    expect(url.searchParams.get('redirect_uri')).toBe('https://green-city-web.vercel.app/api/auth/google/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(data.stateHash).toBe(sessions.hashToken(url.searchParams.get('state')!));
    expect(data.browserHash).toBe(sessions.hashToken(result.browserToken));
    expect(data.nonce).toBe(url.searchParams.get('nonce'));
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(600000);
    expect(GoogleOAuthUrlSchema.safeParse({ url: result.url }).success).toBe(true);
  });
  it.each(['https://evil.test', '//evil.test', '/en/login', '/tai-khoan?next=https://evil.test', '/%2f%2fevil.test'])('rejects unsafe destination %s', async returnTo => {
    expect(GoogleOAuthStartSchema.safeParse({ returnTo }).success).toBe(false);
    await expect(service.start(returnTo)).rejects.toThrow();
    expect(prisma.googleOAuthAttempt.create).not.toHaveBeenCalled();
  });
  it('rejects browser mismatch, expiry and concurrent callback replay before token exchange', async () => {
    const state = 's'.repeat(43), browser = 'b'.repeat(43);
    prisma.googleOAuthAttempt.findFirst.mockResolvedValue(null);
    await expect(service.consume(state, browser)).rejects.toThrow();
    expect(prisma.googleOAuthAttempt.findFirst).toHaveBeenCalledWith({ where: {
      stateHash: sessions.hashToken(state), browserHash: sessions.hashToken(browser), expiresAt: { gt: expect.any(Date) },
    } });
    prisma.googleOAuthAttempt.findFirst.mockResolvedValue({ returnTo: '/tai-khoan' });
    prisma.googleOAuthAttempt.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.consume(state, browser)).rejects.toThrow();
  });
  it('verifies a real RSA-signed ID token and sends the PKCE verifier', async () => {
    const exchange = jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: signed(claims()) } } as never);
    await expect(service.verify('code', 'verifier', 'nonce')).resolves.toEqual({ subject: 'google-subject', email: 'google@example.com', displayName: null });
    expect(exchange).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'verifier' });
  });
  it.each([
    { aud: 'another-client' }, { iss: 'https://evil.test' }, { nonce: 'wrong' }, { email_verified: false },
    { exp: 1 }, { azp: 'another-client' }, { email: 'invalid' }, { sub: '' },
  ])('rejects invalid token claims %j', async override => {
    jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: signed({ ...claims(), ...override }) } } as never);
    await expect(service.verify('code', 'verifier', 'nonce')).rejects.toMatchObject({ response: { code: 'GOOGLE_FAILED' } });
  });
  it('rejects forged signatures and hides provider credentials in errors', async () => {
    const exchange = jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: signed(claims()).slice(0, -10) + 'tampered' } } as never);
    await expect(service.verify('code', 'verifier', 'nonce')).rejects.toThrow('Google sign-in could not be completed');
    exchange.mockImplementation((async () => { throw new Error('private-provider-token'); }) as never);
    await expect(service.verify('code', 'verifier', 'nonce')).rejects.toThrow('Google sign-in could not be completed');
  });
  it('requires explicit linking when email exists and does not mint a session', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'local' });
    await expect(service.finish({ subject: 'sub', email: 'local@example.com', displayName: null }, null, undefined, {})).rejects.toMatchObject({ response: { code: 'GOOGLE_LINK_REQUIRED' } });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
  it('refuses to link if the initiating session changed or email does not match', async () => {
    resolveActiveSession.mockResolvedValue({ session: { id: 'other' }, user: { id: 'u', email: 'local@example.com' } });
    const identity = { subject: 'sub', email: 'local@example.com', displayName: null };
    await expect(service.finish(identity, 'original', 'token', {})).rejects.toThrow();
    resolveActiveSession.mockResolvedValue({ session: { id: 'original' }, user: { id: 'u', email: 'different@example.com' } });
    await expect(service.finish(identity, 'original', 'token', {})).rejects.toThrow();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
