import {
  AccountHistoryQuerySchema,
  AccountHistorySchema,
} from '@greencity/shared';

describe('account history contracts', () => {
  const createdAt = '2026-08-09T00:00:00.000Z';

  it('defaults the dashboard history snapshot to five rows per section', () => {
    expect(AccountHistoryQuerySchema.parse({})).toEqual({ limit: 5 });
    expect(AccountHistoryQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
  });

  it.each([0, 11, 1.5, 'not-a-number'])(
    'rejects an invalid dashboard snapshot limit: %p',
    (limit) => {
      expect(() => AccountHistoryQuerySchema.parse({ limit })).toThrow();
    },
  );

  it('rejects a non-positive payment amount', () => {
    expect(() =>
      AccountHistorySchema.parse({
        reservations: [],
        subscriptions: [],
        payments: [
          {
            id: 'payment-zero',
            provider: 'PAYOS',
            status: 'PAID',
            amountVnd: 0,
            createdAt,
            paidAt: createdAt,
          },
        ],
      }),
    ).toThrow();
  });

  it('returns only safe reservation, subscription, and payment display fields', () => {
    const parsed = AccountHistorySchema.parse({
      reservations: [
        {
          id: 'reservation-1',
          categoryName: 'Giấy carton',
          estimatedWeightKg: 12.5,
          buyerPricePerKgVnd: 3000,
          estimatedTotalVnd: 37500,
          status: 'RESERVED',
          createdAt,
          sellerId: 'must-not-leak',
          sellerEmail: 'private@example.test',
        },
      ],
      subscriptions: [
        {
          id: 'subscription-1',
          status: 'ACTIVE',
          startsAt: createdAt,
          expiresAt: '2026-09-08T00:00:00.000Z',
          userId: 'must-not-leak',
          note: 'admin-only context must not leak',
        },
      ],
      payments: [
        {
          id: 'payment-1',
          provider: 'PAYOS',
          status: 'PAID',
          amountVnd: 50000,
          createdAt,
          paidAt: createdAt,
          providerCheckoutUrl: 'https://checkout.example.test/secret',
          providerOrderId: 'secret-order-id',
          providerPaymentId: 'secret-payment-id',
          providerTransactionId: 'secret-transaction-id',
        },
      ],
    });

    expect(parsed).toEqual({
      reservations: [
        {
          id: 'reservation-1',
          categoryName: 'Giấy carton',
          estimatedWeightKg: 12.5,
          buyerPricePerKgVnd: 3000,
          estimatedTotalVnd: 37500,
          status: 'RESERVED',
          createdAt,
        },
      ],
      subscriptions: [
        {
          id: 'subscription-1',
          status: 'ACTIVE',
          startsAt: createdAt,
          expiresAt: '2026-09-08T00:00:00.000Z',
        },
      ],
      payments: [
        {
          id: 'payment-1',
          provider: 'PAYOS',
          status: 'PAID',
          amountVnd: 50000,
          createdAt,
          paidAt: createdAt,
        },
      ],
    });
  });
});
