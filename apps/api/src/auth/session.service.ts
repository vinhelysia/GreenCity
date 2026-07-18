import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Session, User } from '@prisma/client';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export type SessionUser = User;

export interface ActiveSession {
  session: Session;
  user: SessionUser;
  /** Raw token only present at creation time for cookie set. */
  rawToken?: string;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  createRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  async createSession(input: {
    userId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ rawToken: string; session: Session }> {
    const env = loadEnv();
    const rawToken = this.createRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    );

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt,
        userAgent: input.userAgent?.slice(0, 512),
        ipAddress: input.ipAddress?.slice(0, 64),
      },
    });

    return { rawToken, session };
  }

  async resolveActiveSession(rawToken: string | undefined): Promise<ActiveSession> {
    if (!rawToken || rawToken.length < 16) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    if (session.revokedAt) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Session has been revoked',
      });
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session has expired',
      });
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'USER_DISABLED',
        message: 'Account is not active',
      });
    }

    return { session, user: session.user };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
