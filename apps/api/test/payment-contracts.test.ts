import {
  SubscriptionPaymentStatusSchema,
  CreateSubscriptionPaymentResponseSchema,
  SubscriptionPaymentStatusResponseSchema,
  SubscriptionStateSchema,
  PAYMENT_ERROR_CODES,
} from '@greencity/shared';

describe('payment contracts', () => {
  it('pins the payment status state machine', () => {
    expect(SubscriptionPaymentStatusSchema.options).toEqual([
      'PENDING',
      'PAID',
      'FAILED',
    ]);
  });

  it('parses create subscription payment response', () => {
    const valid = {
      paymentId: 'pay-123',
      payUrl: 'https://test-payment.momo.vn/v2/gateway/api/create?s=123',
    };
    expect(CreateSubscriptionPaymentResponseSchema.parse(valid)).toEqual(valid);
  });

  it('parses payment status response', () => {
    const valid = {
      id: 'pay-123',
      status: 'PAID',
      amountVnd: 50000,
      paidAt: new Date().toISOString(),
    };
    expect(SubscriptionPaymentStatusResponseSchema.parse(valid)).toEqual(valid);
  });

  it('defaults checkoutAvailable to false for backwards compatibility during rollout', () => {
    const withoutCheckout = {
      eligible: false,
      subscription: null,
    };
    const parsed = SubscriptionStateSchema.parse(withoutCheckout);
    expect(parsed.checkoutAvailable).toBe(false);

    const withCheckout = {
      eligible: true,
      subscription: null,
      checkoutAvailable: true,
    };
    expect(SubscriptionStateSchema.parse(withCheckout).checkoutAvailable).toBe(true);
  });

  it('exposes a unique, stable set of payment error codes', () => {
    expect(new Set(PAYMENT_ERROR_CODES).size).toBe(PAYMENT_ERROR_CODES.length);
    expect(PAYMENT_ERROR_CODES).toContain('PAYMENT_NOT_CONFIGURED');
    expect(PAYMENT_ERROR_CODES).toContain('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(PAYMENT_ERROR_CODES).toContain('PAYMENT_PROVIDER_REJECTED');
    expect(PAYMENT_ERROR_CODES).toContain('PAYMENT_NOT_FOUND');
  });
});
