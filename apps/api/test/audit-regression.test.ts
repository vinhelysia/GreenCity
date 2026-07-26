import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthContext } from '../src/authz/auth-context';
import { AuthService } from '../src/auth/auth.service';
import { OriginGuard, SkipOriginCheck } from '../src/common/origin.guard';
import { loadEnv } from '../src/config/env';
import { MediaService } from '../src/media/media.service';
import sharp from 'sharp';

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

describe('audit regressions', () => {
  it('performs password verification for an unknown login account', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const passwords = { verify: jest.fn().mockResolvedValue(false) };
    const service = new AuthService(
      prisma as never,
      passwords as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.login(
        { email: 'missing@example.com', password: 'password-123' },
        {},
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(passwords.verify).toHaveBeenCalledTimes(1);
    expect(passwords.verify.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$/);
  });

  it.each(['*', 'not-an-origin', 'https://example.com/path'])(
    'rejects invalid CORS_ORIGINS entry %s',
    (origin) => {
      expect(() => loadEnv({ ...baseEnv, CORS_ORIGINS: origin })).toThrow(
        'Invalid environment configuration',
      );
    },
  );

  it('rejects multiple Origin headers', () => {
    // A real Reflector with no metadata on the context: the route under test
    // has not opted out of the Origin check, which is the point.
    const guard = new OriginGuard(new Reflector());
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      headersDistinct: {
        origin: ['http://localhost:3000', 'https://evil.example'],
      },
      cookies: { gc_session: 'opaque-session-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow('Origin is not allowed');
  });

  it('honours SkipOriginCheck on the decorated route and nowhere else', () => {
    class WebhookLike {
      @SkipOriginCheck()
      handle(): void {}
    }
    class OrdinaryLike {
      handle(): void {}
    }

    const guard = new OriginGuard(new Reflector());
    // The shape payOS arrives in: unsafe method, no Origin, no session.
    const req = {
      method: 'POST',
      headers: {},
      headersDistinct: {},
      cookies: {},
    };
    const contextFor = (target: object, handler: unknown) =>
      ({
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => handler,
        getClass: () => target,
      }) as unknown as ExecutionContext;

    expect(
      guard.canActivate(
        contextFor(WebhookLike, WebhookLike.prototype.handle),
      ),
    ).toBe(true);

    // The exemption is opt-in: an identical request on any other route still
    // fails, which is what keeps this from becoming an app-wide CSRF hole.
    expect(() =>
      guard.canActivate(
        contextFor(OrdinaryLike, OrdinaryLike.prototype.handle),
      ),
    ).toThrow('Origin is not allowed');
  });

  it('removes a stored upload when the metadata write fails', async () => {
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .png()
      .toBuffer();
    const prisma = {
      mediaAsset: {
        create: jest.fn().mockRejectedValue(new Error('database down')),
      },
    };
    const storage = {
      driver: 'local',
      putObject: jest.fn().mockResolvedValue({ key: 'key', uri: 'internal' }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MediaService(
      prisma as never,
      storage as never,
      { record: jest.fn() } as never,
    );
    const auth = {
      user: { id: 'owner' },
      roles: ['USER'],
      sessionId: 'session',
    } as AuthContext;

    await expect(
      service.upload(auth, {
        buffer: png,
        mimetype: 'image/png',
        originalname: 'image.png',
      }),
    ).rejects.toThrow('database down');
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(
      storage.putObject.mock.calls[0]?.[0].key,
    );
  });
});
