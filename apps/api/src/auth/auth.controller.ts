import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@greencity/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { loadEnv } from '../config/env';
import { Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { clearSessionCookie, setSessionCookie } from './cookie';
import { Public } from '../authz/authenticated.guard';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';

const AUTH_THROTTLE = {
  default: {
    limit: () => loadEnv().AUTH_LOGIN_RATE_LIMIT,
    ttl: () => loadEnv().AUTH_LOGIN_RATE_TTL_SECONDS * 1000,
  },
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(body, {
      userAgent: req.header('user-agent') ?? undefined,
      ipAddress: req.ip,
      requestId: getRequestId(req),
    });
    setSessionCookie(res, result.rawToken);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  @Public()
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body, {
      userAgent: req.header('user-agent') ?? undefined,
      ipAddress: req.ip,
      requestId: getRequestId(req),
    });
    setSessionCookie(res, result.rawToken);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() ctx: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(ctx.sessionId, ctx.user.id, getRequestId(req));
    clearSessionCookie(res);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @CurrentUser() ctx: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.logoutAll(ctx.user.id, getRequestId(req));
    clearSessionCookie(res);
    return { ok: true, revoked: result.revoked };
  }

  @Get('me')
  me(@CurrentUser() ctx: AuthContext) {
    return { user: this.auth.me(ctx.user) };
  }
}
