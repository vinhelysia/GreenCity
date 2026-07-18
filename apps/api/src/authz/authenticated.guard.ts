import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { loadEnv } from '../config/env';
import { SessionService } from '../auth/session.service';
import type { AuthContext } from './auth-context';

const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const req = context.switchToHttp().getRequest<
      Request & { auth?: AuthContext; cookies?: Record<string, string> }
    >();
    const env = loadEnv();
    const raw =
      req.cookies?.[env.SESSION_COOKIE_NAME] ??
      // Allow Authorization: Bearer for non-browser tests only (still opaque session token)
      (typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);

    if (!raw) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const active = await this.sessions.resolveActiveSession(raw);
    req.auth = {
      user: active.user,
      sessionId: active.session.id,
      roles: active.user.roles,
    };
    return true;
  }
}
