import {
  CreateQuoteRequestSchema,
  CreateScrapRequestSchema,
  ListingStatusSchema,
  MARKETPLACE_ERROR_CODES,
  MarketplaceListingSchema,
  QuoteStatusSchema,
  ScrapRequestStatusSchema,
  SubscriptionStatusSchema,
} from '@greencity/shared';

/**
 * The marketplace contracts are the one place backend and frontend agree, so the
 * boundaries that carry money or hide the seller get a check rather than trust.
 * Nothing here touches a database — this belongs to the unit lane.
 */
describe('marketplace contracts', () => {
  const listing = {
    id: 'listing-1',
    categoryName: 'Chai nhựa PET',
    estimatedWeightKg: 10,
    buyerPricePerKgVnd: 1400,
    estimatedTotalVnd: 14000,
    status: 'AVAILABLE',
    mediaDownloadPath: '/api/media/asset-1/content',
    isOwn: false,
    createdAt: new Date().toISOString(),
  };

  it('keeps the seller unidentifiable in the buyer-facing listing', () => {
    const parsed = MarketplaceListingSchema.parse({
      ...listing,
      sellerId: 'user-should-not-leak',
      sellerEmail: 'seller@example.com',
      sellerPricePerKgVnd: 1000,
    });

    expect(parsed).not.toHaveProperty('sellerId');
    expect(parsed).not.toHaveProperty('sellerEmail');
    // The row stores the seller-side price for accounting; the DTO must not.
    expect(parsed).not.toHaveProperty('sellerPricePerKgVnd');
    expect(JSON.stringify(parsed)).not.toContain('user-should-not-leak');
  });

  it('rejects non-integer VND everywhere money is expressed', () => {
    expect(() =>
      MarketplaceListingSchema.parse({ ...listing, buyerPricePerKgVnd: 1400.5 }),
    ).toThrow();
    expect(() =>
      CreateQuoteRequestSchema.parse({ pricePerKgVnd: 1250.75 }),
    ).toThrow();
    expect(() => CreateQuoteRequestSchema.parse({ pricePerKgVnd: 0 })).toThrow();
    expect(() =>
      CreateQuoteRequestSchema.parse({ pricePerKgVnd: -1000 }),
    ).toThrow();
    expect(CreateQuoteRequestSchema.parse({ pricePerKgVnd: 1250 })).toEqual({
      pricePerKgVnd: 1250,
    });
  });

  it('requires exactly one owned photo and a positive weight on submission', () => {
    const base = { categoryId: 'cat-1', estimatedWeightKg: 10, mediaAssetId: 'm1' };

    expect(CreateScrapRequestSchema.parse(base)).toMatchObject(base);
    // Missing photo — one photo is required, not optional.
    expect(() =>
      CreateScrapRequestSchema.parse({ ...base, mediaAssetId: undefined }),
    ).toThrow();
    expect(() =>
      CreateScrapRequestSchema.parse({ ...base, mediaAssetId: '' }),
    ).toThrow();
    expect(() =>
      CreateScrapRequestSchema.parse({ ...base, estimatedWeightKg: 0 }),
    ).toThrow();
    expect(() =>
      CreateScrapRequestSchema.parse({ ...base, estimatedWeightKg: -5 }),
    ).toThrow();
  });

  it('never lets a client set a server-controlled status', () => {
    const parsed = CreateScrapRequestSchema.parse({
      categoryId: 'cat-1',
      estimatedWeightKg: 10,
      mediaAssetId: 'm1',
      status: 'ACCEPTED',
      sellerId: 'someone-else',
    });

    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('sellerId');
  });

  it('pins the state machines so Prisma enums cannot drift silently', () => {
    expect(ScrapRequestStatusSchema.options).toEqual([
      'SUBMITTED',
      'QUOTED',
      'ACCEPTED',
      'REJECTED',
    ]);
    expect(QuoteStatusSchema.options).toEqual([
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'SUPERSEDED',
    ]);
    expect(ListingStatusSchema.options).toEqual([
      'AVAILABLE',
      'RESERVED',
      'COMPLETED',
      'CANCELLED',
    ]);
    expect(SubscriptionStatusSchema.options).toEqual([
      'ACTIVE',
      'EXPIRED',
      'CANCELLED',
    ]);
  });

  it('exposes a unique, stable set of error codes', () => {
    expect(new Set(MARKETPLACE_ERROR_CODES).size).toBe(
      MARKETPLACE_ERROR_CODES.length,
    );
    expect(MARKETPLACE_ERROR_CODES).toContain('LISTING_NOT_AVAILABLE');
    expect(MARKETPLACE_ERROR_CODES).toContain('SUBSCRIPTION_REQUIRED');
    expect(MARKETPLACE_ERROR_CODES).toContain('CANNOT_RESERVE_OWN_LISTING');
    expect(MARKETPLACE_ERROR_CODES).toContain('QUOTE_OUT_OF_PUBLISHED_RANGE');
  });
});
