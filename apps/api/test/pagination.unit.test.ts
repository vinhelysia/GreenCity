import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  MarketplaceListingListSchema,
  PaginationCursorSchema,
  PaginationQuerySchema,
  ScrapRequestListSchema,
} from '@greencity/shared';
import { AdminController } from '../src/marketplace/admin.controller';
import { ListingController } from '../src/marketplace/listing.controller';
import { ListingService } from '../src/marketplace/listing.service';
import { ScrapRequestService } from '../src/marketplace/scrap-request.service';
import { RolesGuard } from '../src/authz/roles.guard';
import { ROLES_KEY } from '../src/authz/roles.decorator';
import {
  decodePaginationCursor,
  encodePaginationCursor,
  parsePaginationQuery,
  paginationKeysetWhere,
} from '../src/common/pagination';

describe('cursor pagination contract', () => {
  const cursor = {
    createdAt: '2026-08-09T10:00:00.000Z',
    id: 'listing_000000000000000000000001',
  };

  it('defaults limit to 20 and coerces a bounded integer limit', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(PaginationQuerySchema.parse({ limit: '50' })).toEqual({ limit: 50 });
  });

  it('rejects limits outside the supported page size range', () => {
    expect(() => PaginationQuerySchema.parse({ limit: '0' })).toThrow();
    expect(() => PaginationQuerySchema.parse({ limit: '51' })).toThrow();
    expect(() => PaginationQuerySchema.parse({ limit: '2.5' })).toThrow();
  });

  it('round-trips an opaque cursor and uses a deterministic keyset predicate', () => {
    const token = encodePaginationCursor({
      createdAt: new Date(cursor.createdAt),
      id: cursor.id,
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(PaginationQuerySchema.parse({ cursor: token })).toEqual({
      limit: 20,
      cursor: token,
    });
    expect(decodePaginationCursor(token)).toEqual({
      createdAt: new Date(cursor.createdAt),
      id: cursor.id,
    });
    expect(paginationKeysetWhere(decodePaginationCursor(token))).toEqual({
      OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ],
    });
  });

  it('keeps nextCursor additive in both existing response envelopes', () => {
    const nextCursor = encodePaginationCursor({
      createdAt: new Date(cursor.createdAt),
      id: cursor.id,
    });
    expect(MarketplaceListingListSchema.parse({
      listings: [],
      nextCursor,
    })).toMatchObject({ listings: [] });
    expect(ScrapRequestListSchema.parse({ requests: [], nextCursor })).toMatchObject({
      requests: [],
    });
  });

  it('rejects malformed, non-canonical, and oversized cursor payloads at the API boundary', async () => {
    expect(() => parsePaginationQuery({ limit: 20, cursor: 'not-base64!' })).toThrow();
    expect(() => parsePaginationQuery({
      limit: 20,
      cursor: 'eyJjcmVhdGVkQXQiOiJub3QtYS1kYXRlIn0',
    })).toThrow();
    expect(() =>
      PaginationCursorSchema.parse({
        ...cursor,
        id: 'x'.repeat(129),
      }),
    ).toThrow();

    const controller = new ListingController(
      { list: jest.fn() } as never,
      { resolveActiveSession: jest.fn() } as never,
    );
    await expect(
      controller.list(
        { limit: 20, cursor: 'eyJjcmVhdGVkQXQiOiJub3QtYS1kYXRlIn0' },
        {} as never,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('listing pagination authorization boundary', () => {
  it('keeps the admin listing controller behind RolesGuard and ADMIN metadata', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toContain(
      RolesGuard,
    );
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['ADMIN']);
  });
});

describe('listing and scrap-request pagination queries', () => {
  const createdAt = new Date('2026-08-09T10:00:00.000Z');
  const page = {
    limit: 2,
    cursor: { createdAt, id: 'cursor-row' },
  };

  function listingRow(id: string, rowCreatedAt: Date) {
    return {
      id,
      sellerId: 'seller-1',
      categoryName: 'Plastic bottles',
      estimatedWeightKg: 2,
      buyerPricePerKgVnd: 1200,
      status: 'AVAILABLE',
      createdAt: rowCreatedAt,
      scrapRequest: {
        category: {
          minPricePerKgVnd: 1000,
          maxPricePerKgVnd: 1400,
        },
      },
    } as never;
  }

  it('queries buyer listings with status AND keyset, a stable order, and one look-ahead row', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ListingService(
      { marketplaceListing: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.list(null, page);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { status: 'AVAILABLE' },
          paginationKeysetWhere(page.cursor),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    }));
  });

  it('preserves an admin status filter while applying the same keyset page', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ListingService(
      { marketplaceListing: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.adminList('RESERVED', page);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { status: 'RESERVED' },
          paginationKeysetWhere(page.cursor),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    }));
  });

  it('keeps the authenticated seller filter in the database query despite a foreign cursor id', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ScrapRequestService(
      { scrapRequest: { findMany } } as never,
      {} as never,
    );

    await service.mine(
      { user: { id: 'owner-1' }, roles: ['USER'], sessionId: 'session-1' } as never,
      { ...page, cursor: { ...page.cursor, id: 'foreign-owner-row' } },
    );

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { sellerId: 'owner-1' },
          paginationKeysetWhere({
            ...page.cursor,
            id: 'foreign-owner-row',
          }),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    }));
  });

  it('uses the last emitted row as the cursor so a stable transition does not duplicate tied timestamps', async () => {
    const a = listingRow('a', new Date('2026-08-09T10:01:00.000Z'));
    const b = listingRow('b', createdAt);
    const c = listingRow('a-after-b', createdAt);
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([a, b, c])
      .mockResolvedValueOnce([c]);
    const service = new ListingService(
      { marketplaceListing: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const first = await service.list(null, { limit: 2 });
    const second = await service.list(null, {
      limit: 2,
      cursor: decodePaginationCursor(first.nextCursor!),
    });

    expect(first.listings.map((listing) => listing.id)).toEqual(['a', 'b']);
    expect(second.listings.map((listing) => listing.id)).toEqual(['a-after-b']);
    expect(first.listings.map((listing) => listing.id)).not.toContain('a-after-b');
    expect(paginationKeysetWhere(decodePaginationCursor(first.nextCursor!))).toEqual({
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: 'b' } },
      ],
    });
  });
});
