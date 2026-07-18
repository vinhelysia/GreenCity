import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RegisterRequest, LoginRequest, PublicUser } from '@greencity/shared';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail, toPublicUser } from './auth.mapper';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const INVALID_LOGIN = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: RegisterRequest,
    meta: { userAgent?: string; ipAddress?: string; requestId?: string },
  ): Promise<{ user: PublicUser; rawToken: string }> {
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);

    // Ignore any client-supplied role/status if present on a looser body.
    const data = {
      email,
      passwordHash,
      displayName: input.displayName ?? null,
      phone: input.phone?.trim() || null,
      roles: ['USER' as const],
      status: 'ACTIVE' as const,
    };

    let user;
    try {
      user = await this.prisma.user.create({ data });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'An account with this email already exists',
        });
      }
      throw err;
    }

    // Session fixation: always mint a fresh session after register.
    const { rawToken } = await this.sessions.createSession({
      userId: user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      targetType: 'User',
      targetId: user.id,
      requestId: meta.requestId,
      metadata: { email },
    });

    return { user: toPublicUser(user), rawToken };
  }

  async login(
    input: LoginRequest,
    meta: { userAgent?: string; ipAddress?: string; requestId?: string },
  ): Promise<{ user: PublicUser; rawToken: string }> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    const ok = await this.passwords.verify(user.passwordHash, input.password);
    if (!ok) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    // Session fixation prevention: new opaque token on every login.
    const { rawToken } = await this.sessions.createSession({
      userId: user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'User',
      targetId: user.id,
      requestId: meta.requestId,
      metadata: { email },
    });

    return { user: toPublicUser(user), rawToken };
  }

  async logout(
    sessionId: string,
    actorId: string,
    requestId?: string,
  ): Promise<void> {
    await this.sessions.revokeSession(sessionId);
    await this.audit.record({
      actorId,
      action: 'auth.logout',
      targetType: 'Session',
      targetId: sessionId,
      requestId,
    });
  }

  async logoutAll(
    userId: string,
    requestId?: string,
  ): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeAllForUser(userId);
    await this.audit.record({
      actorId: userId,
      action: 'auth.logout_all',
      targetType: 'User',
      targetId: userId,
      requestId,
      metadata: { revoked },
    });
    return { revoked };
  }

  me(user: { id: string } & PublicUser | import('@prisma/client').User): PublicUser {
    return toPublicUser(user as import('@prisma/client').User);
  }
}
