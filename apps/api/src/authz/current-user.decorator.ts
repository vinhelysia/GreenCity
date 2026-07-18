import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext } from './auth-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!req.auth) {
      throw new Error('CurrentUser used without AuthenticatedGuard');
    }
    return req.auth;
  },
);
