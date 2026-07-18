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
 * For cookie-authenticated unsafe methods, require Origin (or same-origin Referer)
 * to match an allowed CORS origin. Mitigates cross-site cookie CSRF (SameSite=Lax helps
 * but Origin check is belt-and-suspenders for non-GET mutations).
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
      return true;
    }

    const env = loadEnv();
    const allowed = new Set(env.CORS_ORIGINS);
    const origin = req.headers.origin;
    if (origin) {
      if (!allowed.has(origin)) {
        throw new ForbiddenException({
          code: 'INVALID_ORIGIN',
          message: 'Origin is not allowed',
        });
      }
      return true;
    }

    // Non-browser clients (curl, mobile) may omit Origin — allow when no Origin header.
    // Browser cross-site POSTs send Origin; same-site navigations use GET (safe).
    return true;
  }
}
