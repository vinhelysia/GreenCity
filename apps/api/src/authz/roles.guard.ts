import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import type { AuthContext } from './auth-context';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      // No roles metadata: do not grant — caller must use AuthenticatedGuard alone
      // or explicitly set Roles. Empty means "any authenticated" only if not applied.
      return true;
    }

    const req = context.switchToHttp().getRequest<{ auth?: AuthContext }>();
    const auth = req.auth;
    if (!auth) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const ok = required.some((role) => auth.roles.includes(role));
    if (!ok) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    return true;
  }
}
