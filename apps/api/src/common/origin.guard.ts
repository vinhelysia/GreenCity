import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { loadEnv } from '../config/env';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Unsafe browser requests require exactly one allowed Origin. Non-browser
 * clients may omit Origin only with an explicit bearer session token.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & { cookies?: Record<string, string> }
    >();
    if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
      return true;
    }

    const env = loadEnv();
    const origins = req.headersDistinct.origin ?? [];
    if (origins.length === 1 && env.CORS_ORIGINS.includes(origins[0]!)) {
      return true;
    }

    const authorization = req.headers.authorization;
    const hasCookieSession = Boolean(req.cookies?.[env.SESSION_COOKIE_NAME]);
    if (
      origins.length === 0 &&
      !hasCookieSession &&
      authorization?.startsWith('Bearer ') &&
      authorization.length > 'Bearer '.length
    ) {
      return true;
    }

    throw new ForbiddenException({
      code: 'INVALID_ORIGIN',
      message: 'Origin is not allowed',
    });
  }
}
