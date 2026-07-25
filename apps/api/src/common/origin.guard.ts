import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { loadEnv } from '../config/env';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SKIP_ORIGIN_CHECK = 'skipOriginCheck';

/**
 * Exempts one route from the Origin requirement. Reserved for server-to-server
 * callbacks that legitimately arrive without an Origin and without a session —
 * currently only the signed MoMo IPN, which authenticates itself by HMAC.
 *
 * Deliberately separate from @Public(): being unauthenticated says nothing
 * about whether a request came from a browser, and every other public POST must
 * keep its CSRF protection.
 */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);

/**
 * Unsafe browser requests require exactly one allowed Origin. Non-browser
 * clients may omit Origin only with an explicit bearer session token.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & { cookies?: Record<string, string> }
    >();
    if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
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
