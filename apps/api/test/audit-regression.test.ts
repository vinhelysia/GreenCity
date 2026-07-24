import type { ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../src/authz/auth-context';
import { AuthService } from '../src/auth/auth.service';
import { OriginGuard } from '../src/common/origin.guard';
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
    const guard = new OriginGuard();
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
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow('Origin is not allowed');
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

  /**
   * This used to assert the opposite: the object was deleted first, and a
   * storage failure left the row untouched. That guarded the harmless failure
   * and left the damaging one open — storage deletes, the update then fails,
   * and a live record points at a file that is gone, which serves a broken
   * image forever. deletedAt is what stops the file being served, so the row
   * leads and an unreachable object is the acceptable residue.
   */
  it('keeps the delete applied for readers when storage deletion fails', async () => {
    const asset = {
      id: 'asset',
      ownerId: 'owner',
      objectKey: 'media/owner/asset.jpg',
      deletedAt: null,
    };
    const prisma = {
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue(asset),
        update: jest.fn().mockResolvedValue({ ...asset, deletedAt: new Date() }),
      },
      marketplaceListing: { count: jest.fn().mockResolvedValue(0) },
      cleanupReport: { count: jest.fn().mockResolvedValue(0) },
      scrapRequest: { count: jest.fn().mockResolvedValue(0) },
    };
    const storage = {
      driver: 'local',
      deleteObject: jest.fn().mockRejectedValue(new Error('storage down')),
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

    await expect(service.softDelete(auth, asset.id)).resolves.toBeUndefined();
    expect(prisma.mediaAsset.update).toHaveBeenCalled();
  });

  it('refuses to delete media that a submission still points at', async () => {
    const asset = {
      id: 'asset',
      ownerId: 'owner',
      objectKey: 'media/owner/asset.jpg',
      deletedAt: null,
    };
    const prisma = {
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue(asset),
        update: jest.fn(),
      },
      marketplaceListing: { count: jest.fn().mockResolvedValue(1) },
      cleanupReport: { count: jest.fn().mockResolvedValue(0) },
      scrapRequest: { count: jest.fn().mockResolvedValue(0) },
    };
    const storage = { driver: 'local', deleteObject: jest.fn() };
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

    await expect(service.softDelete(auth, asset.id)).rejects.toThrow();
    expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
