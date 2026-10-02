import { Body, ConflictException, Controller, Get, Header, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GoogleOAuthStartSchema, type GoogleOAuthStart } from '@greencity/shared';
import type { Request, Response } from 'express';
import { Public } from '../authz/authenticated.guard';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { loadEnv } from '../config/env';
import { setSessionCookie } from './cookie';
import { GoogleAuthService, GOOGLE_COOKIE, GOOGLE_TTL_MS } from './google-auth.service';

const throttle = { default: {
  limit: () => loadEnv().AUTH_LOGIN_RATE_LIMIT,
  ttl: () => loadEnv().AUTH_LOGIN_RATE_TTL_SECONDS * 1000,
} };

@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly google: GoogleAuthService) {}

  @Get('status')
  @Public()
  @Header('Cache-Control', 'private, no-store')
  status(@Req() req: Request) {
    return this.google.status(req.cookies?.[loadEnv().SESSION_COOKIE_NAME]);
  }

  private async begin(returnTo: string, res: Response, sessionId?: string) {
    const { url, browserToken } = await this.google.start(returnTo, sessionId);
    res.cookie(GOOGLE_COOKIE, browserToken, {
      httpOnly: true, secure: loadEnv().NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: GOOGLE_TTL_MS,
    });
    return { url };
  }

  @Post('start')
  @Public()
  @HttpCode(200)
  @Throttle(throttle)
  @Header('Cache-Control', 'private, no-store')
  start(@Body(new ZodValidationPipe(GoogleOAuthStartSchema)) body: GoogleOAuthStart, @Res({ passthrough: true }) res: Response) {
    return this.begin(body.returnTo, res);
  }

  @Post('link')
  @HttpCode(200)
  @Throttle(throttle)
  @Header('Cache-Control', 'private, no-store')
  link(@CurrentUser() auth: AuthContext, @Body(new ZodValidationPipe(GoogleOAuthStartSchema)) body: GoogleOAuthStart,
    @Res({ passthrough: true }) res: Response) {
    return this.begin(body.returnTo.startsWith('/en') ? '/en/account' : '/tai-khoan', res, auth.sessionId);
  }

  @Get('callback')
  @Public()
  @Throttle(throttle)
  async callback(@Query() query: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    let returnTo = '/tai-khoan';
    let linking = false;
    try {
      const attempt = await this.google.consume(query.state, req.cookies?.[GOOGLE_COOKIE]);
      res.clearCookie(GOOGLE_COOKIE, { httpOnly: true, secure: loadEnv().NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      returnTo = attempt.returnTo;
      linking = Boolean(attempt.sessionId);
      if (query.error !== undefined) throw new Error('Google authorization declined');
      const identity = await this.google.verify(query.code, attempt.codeVerifier, attempt.nonce);
      const result = await this.google.finish(identity, attempt.sessionId, req.cookies?.[loadEnv().SESSION_COOKIE_NAME], {
        userAgent: req.header('user-agent'), ipAddress: req.ip, requestId: getRequestId(req),
      });
      setSessionCookie(res, result.rawToken);
      return res.redirect(303, `${this.google.webURL()}${returnTo}${linking ? '?googleLinked=1' : ''}`);
    } catch (err) {
      // Provider/DB errors never appear in callback URLs, page content or logs.
      const error = err instanceof ConflictException ? 'link_required' : 'failed';
      const english = returnTo.startsWith('/en');
      const destination = linking ? (english ? '/en/account' : '/tai-khoan') : (english ? '/en/login' : '/dang-nhap');
      const params = new URLSearchParams({ googleError: error });
      return res.redirect(303, `${this.google.webURL()}${destination}?${params}`);
    }
  }
}
