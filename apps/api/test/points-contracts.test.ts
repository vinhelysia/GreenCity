import { RewardOfferSchema, RewardOffersSchema } from '@greencity/shared';

/**
 * RewardOfferSchema is the one place backend and frontend agree that this
 * catalog is demo-only. Nothing here touches a database — this belongs to
 * the unit lane.
 */
describe('reward offer contracts', () => {
  const offer = {
    slug: 'starbucks-50000',
    merchantNameVi: 'Starbucks',
    merchantNameEn: 'Starbucks',
    offerVi: 'Voucher đồ uống trị giá 50.000 ₫.',
    offerEn: 'A beverage voucher worth VND 50,000.',
    pointsCost: 500,
    demoOnly: true,
  };

  it('strips internal fields a careless select could leak', () => {
    const parsed = RewardOfferSchema.parse({
      ...offer,
      id: 'reward-offer-1',
      isActive: true,
      sortOrder: 10,
      createdAt: new Date().toISOString(),
    });

    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('isActive');
    expect(parsed).not.toHaveProperty('sortOrder');
    expect(parsed).not.toHaveProperty('createdAt');
    expect(parsed).toEqual(offer);
  });

  it('rejects demoOnly: false — the endpoint can only ever serve demo offers', () => {
    expect(() =>
      RewardOfferSchema.parse({ ...offer, demoOnly: false }),
    ).toThrow();
  });

  it('rejects a zero or negative pointsCost', () => {
    expect(() => RewardOfferSchema.parse({ ...offer, pointsCost: 0 })).toThrow();
    expect(() =>
      RewardOfferSchema.parse({ ...offer, pointsCost: -500 }),
    ).toThrow();
  });

  it('rejects a fractional pointsCost', () => {
    expect(() =>
      RewardOfferSchema.parse({ ...offer, pointsCost: 12.5 }),
    ).toThrow();
  });

  // Both merchant names are required, not merely present: a blank one renders
  // a nameless card in exactly one locale, which is the kind of gap that
  // survives a Vietnamese-only review.
  it.each([
    'slug',
    'merchantNameVi',
    'merchantNameEn',
    'offerVi',
    'offerEn',
  ] as const)('rejects an empty %s', (field) => {
    expect(() => RewardOfferSchema.parse({ ...offer, [field]: '' })).toThrow();
  });

  it('rejects an offer missing a localized merchant name entirely', () => {
    const { merchantNameEn: _dropped, ...withoutEn } = offer;
    expect(() => RewardOfferSchema.parse(withoutEn)).toThrow();
  });

  it('parses the catalog as a bare array, empty included', () => {
    expect(RewardOffersSchema.parse([])).toEqual([]);
    expect(RewardOffersSchema.parse([offer])).toEqual([offer]);
  });

  it('rejects the old { offers: [...] } envelope', () => {
    expect(() => RewardOffersSchema.parse({ offers: [offer] })).toThrow();
  });
});
