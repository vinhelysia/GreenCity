import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuthContext } from '../src/authz/auth-context';
import { ScrapRequestService } from '../src/marketplace/scrap-request.service';
import { ListingService } from '../src/marketplace/listing.service';

/**
 * Prisma-mocked unit lane for the two money/ownership rules that must never
 * regress silently: an admin cannot quote outside the published band, and a
 * seller cannot reserve their own listing. No database involved.
 */
describe('marketplace unit', () => {
  it('keeps demo seed credentials and subscriptions safe', () => {
    const source = readFileSync(
      resolve(__dirname, '../prisma/seed.ts'),
      'utf8',
    );
    // Password is env-overridable (safe on a deployed DB) with a local-demo
    // default (zero-setup `pnpm db:seed`). The default is intentional, not a leak.
    expect(source).toContain('process.env.DEMO_PASSWORD ??');
    expect(source).toContain('startsAt: { lte: now }');
    expect(source).toContain('expiresAt: { gt: now }');
  });

  it('rejects an admin quote outside the published price band', async () => {
    const prisma = {
      scrapRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'req-1',
          sellerId: 'seller-1',
          status: 'SUBMITTED',
          category: {
            id: 'cat-1',
            name: 'Chai nhựa PET',
            minPricePerKgVnd: 1000,
            maxPricePerKgVnd: 1500,
            active: true,
          },
        }),
      },
    };
    const service = new ScrapRequestService(
      prisma as never,
      { record: jest.fn() } as never,
    );
    const auth = {
      user: { id: 'admin-1' },
      roles: ['ADMIN'],
      sessionId: 's',
    } as AuthContext;

    await expect(
      service.adminQuote(auth, 'req-1', { pricePerKgVnd: 2000 }),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: 'QUOTE_OUT_OF_PUBLISHED_RANGE' },
    });
  });

  it('accepts an admin quote inside the published price band', async () => {
    const created = {
      id: 'quote-1',
      scrapRequestId: 'req-1',
      pricePerKgVnd: 1200,
      status: 'PENDING',
      createdAt: new Date(),
      acceptedAt: null,
    };
    const tx = {
      quote: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue(created),
      },
      scrapRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      scrapRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'req-1',
          sellerId: 'seller-1',
          status: 'SUBMITTED',
          category: {
            id: 'cat-1',
            name: 'Chai nhựa PET',
            minPricePerKgVnd: 1000,
            maxPricePerKgVnd: 1500,
            active: true,
          },
        }),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const service = new ScrapRequestService(
      prisma as never,
      { record: jest.fn() } as never,
    );
    const auth = {
      user: { id: 'admin-1' },
      roles: ['ADMIN'],
      sessionId: 's',
    } as AuthContext;

    const quote = await service.adminQuote(auth, 'req-1', {
      pricePerKgVnd: 1200,
    });
    expect(quote.pricePerKgVnd).toBe(1200);
    expect(quote.status).toBe('PENDING');
  });

  it('rejects a seller reserving their own listing', async () => {
    const prisma = {
      marketplaceListing: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'listing-1',
          sellerId: 'seller-1',
          status: 'AVAILABLE',
        }),
      },
    };
    const subscriptions = { isEligible: jest.fn().mockResolvedValue(true) };
    const service = new ListingService(
      prisma as never,
      {} as never,
      subscriptions as never,
      { record: jest.fn() } as never,
    );
    const auth = {
      user: { id: 'seller-1' },
      roles: ['USER'],
      sessionId: 's',
    } as AuthContext;

    await expect(service.reserve(auth, 'listing-1')).rejects.toMatchObject({
      status: 403,
      response: { code: 'CANNOT_RESERVE_OWN_LISTING' },
    });
    expect(subscriptions.isEligible).toHaveBeenCalledWith('seller-1');
  });

  it('checks subscription eligibility before checking listing existence', async () => {
    const prisma = {
      marketplaceListing: { findUnique: jest.fn() },
    };
    const subscriptions = { isEligible: jest.fn().mockResolvedValue(false) };
    const service = new ListingService(
      prisma as never,
      {} as never,
      subscriptions as never,
      { record: jest.fn() } as never,
    );
    const auth = {
      user: { id: 'buyer-1' },
      roles: ['USER'],
      sessionId: 's',
    } as AuthContext;

    await expect(
      service.reserve(auth, 'does-not-exist'),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'SUBSCRIPTION_REQUIRED' },
    });
    expect(prisma.marketplaceListing.findUnique).not.toHaveBeenCalled();
  });
});
