import type { Response } from 'express';
import { loadEnv } from '../config/env';

export function setSessionCookie(res: Response, rawToken: string): void {
  const env = loadEnv();
  const maxAgeMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  res.cookie(env.SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(res: Response): void {
  const env = loadEnv();
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  });
}
