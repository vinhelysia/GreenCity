import { RewardOfferListSchema, RewardOfferSchema } from '@greencity/shared';

/**
 * RewardOfferSchema is the one place backend and frontend agree that this
 * catalog is demo-only. Nothing here touches a database — this belongs to
 * the unit lane.
 */
describe('reward offer contracts', () => {
  const offer = {
    slug: 'starbucks-beverage-50k',
    merchantName: 'Starbucks',
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

  it('parses an empty catalog', () => {
    expect(RewardOfferListSchema.parse({ offers: [] })).toEqual({ offers: [] });
  });
});
