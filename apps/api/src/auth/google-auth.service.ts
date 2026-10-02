import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { GoogleOAuthStartSchema } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { loadEnv } from '../config/env';
import { normalizeEmail } from './auth.mapper';
import { SessionService } from './session.service';

const Claims = z.object({
  sub: z.string().min(1).max(255), email: z.string().email().max(320),
  email_verified: z.literal(true), nonce: z.string(),
  name: z.string().optional(), azp: z.string().optional(),
});
export const GOOGLE_COOKIE = 'gc_google_oauth';
export const GOOGLE_TTL_MS = 10 * 60 * 1000;
const failed = () => new BadRequestException({ code: 'GOOGLE_FAILED', message: 'Google sign-in could not be completed' });

@Injectable()
export class GoogleAuthService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService, private readonly audit: AuditService) {}

  webURL(): string {
    const url = new URL(loadEnv().PUBLIC_WEB_URL ?? 'http://localhost:3000');
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw failed();
    return url.origin;
  }

  configured(): boolean {
    const env = loadEnv();
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.PUBLIC_WEB_URL);
  }

  private client(): OAuth2Client {
    if (!this.configured()) throw new ServiceUnavailableException({ code: 'GOOGLE_UNAVAILABLE', message: 'Google sign-in is not available' });
    const env = loadEnv();
    return new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${this.webURL()}/api/auth/google/callback`,
      transporterOptions: { timeout: 10000, retry: false },
    });
  }

  async status(rawSession?: string) {
    let linked = false;
    if (rawSession) {
      try { linked = Boolean((await this.sessions.resolveActiveSession(rawSession)).user.googleSubject); }
      catch (err) { if (!(err instanceof UnauthorizedException)) throw err; }
    }
    return { enabled: this.configured(), linked };
  }

  async start(returnTo: string, sessionId?: string) {
    const client = this.client();
    const safeReturn = GoogleOAuthStartSchema.parse({ returnTo }).returnTo;
    const state = randomBytes(32).toString('base64url');
    const browserToken = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    await this.prisma.googleOAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await this.prisma.googleOAuthAttempt.create({ data: {
      stateHash: this.sessions.hashToken(state), browserHash: this.sessions.hashToken(browserToken),
      nonce, codeVerifier, returnTo: safeReturn, sessionId, expiresAt: new Date(Date.now() + GOOGLE_TTL_MS),
    } });
    const url = client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'], access_type: 'online', prompt: 'select_account',
      state, nonce, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
    });
    return { url, browserToken };
  }

  async consume(state: unknown, browserToken: unknown) {
    const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
    if (!token.safeParse(state).success || !token.safeParse(browserToken).success) throw failed();
    const where = {
      stateHash: this.sessions.hashToken(state as string), browserHash: this.sessions.hashToken(browserToken as string),
      expiresAt: { gt: new Date() },
    };
    const attempt = await this.prisma.googleOAuthAttempt.findFirst({ where });
    if (!attempt) throw failed();
    // Database arbitration makes the callback single-use across concurrent API instances.
    const consumed = await this.prisma.googleOAuthAttempt.deleteMany({ where });
    if (consumed.count !== 1) throw failed();
    return attempt;
  }

  async verify(code: unknown, codeVerifier: string, nonce: string) {
    if (!z.string().min(1).max(4096).safeParse(code).success) throw failed();
    const client = this.client();
    try {
      const { tokens } = await client.getToken({ code: code as string, codeVerifier });
      if (!tokens.id_token) throw failed();
      // Google library checks signature, issuer, audience and expiry; also bind to this attempt.
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: loadEnv().GOOGLE_CLIENT_ID });
      const claims = Claims.parse(ticket.getPayload());
      if (claims.nonce !== nonce || (claims.azp && claims.azp !== loadEnv().GOOGLE_CLIENT_ID)) throw failed();
      return { subject: claims.sub, email: normalizeEmail(claims.email), displayName: claims.name?.trim().slice(0, 80) || null };
    } catch {
      // Never let provider errors (which can contain credentials/tokens) reach logs or clients.
      throw failed();
    }
  }

  async finish(identity: { subject: string; email: string; displayName: string | null }, linkSessionId: string | null,
    rawSession: string | undefined, meta: { userAgent?: string; ipAddress?: string; requestId?: string }) {
    try {
      let user;
      if (linkSessionId) {
        const active = await this.sessions.resolveActiveSession(rawSession);
        if (active.session.id !== linkSessionId || active.user.email !== identity.email) throw failed();
        // Require the same signed-in session and matching email; never replace an existing subject.
        const updated = await this.prisma.user.updateMany({
          where: { id: active.user.id, status: 'ACTIVE', OR: [{ googleSubject: null }, { googleSubject: identity.subject }] },
          data: { googleSubject: identity.subject },
        });
        if (updated.count !== 1) throw failed();
        user = active.user;
      } else {
        user = await this.prisma.user.findUnique({ where: { googleSubject: identity.subject } });
        if (!user) {
          if (await this.prisma.user.findUnique({ where: { email: identity.email } })) {
            throw new ConflictException({ code: 'GOOGLE_LINK_REQUIRED', message: 'Sign in to your existing account to link Google' });
          }
          user = await this.prisma.user.create({ data: {
            email: identity.email, googleSubject: identity.subject, displayName: identity.displayName,
            roles: ['USER'], status: 'ACTIVE',
          } });
        }
        if (user.status !== 'ACTIVE') throw failed();
      }
      const { rawToken } = await this.sessions.createSession({ userId: user.id, ...meta });
      await this.audit.record({ actorId: user.id, action: linkSessionId ? 'auth.google_link' : 'auth.google_login',
        targetType: 'User', targetId: user.id, requestId: meta.requestId });
      return { rawToken };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw failed();
      throw err;
    }
  }
}
