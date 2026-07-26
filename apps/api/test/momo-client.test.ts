import { createHmac } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { loadEnv, type AppEnv } from '../src/config/env';
import {
  MOMO_REQUEST_TYPE,
  resolveMomoCheckoutConfig,
  type MomoCheckoutConfig,
} from '../src/payment/momo-config';
import {
  buildCreatePaymentRawSignature,
  buildIpnRawSignature,
  signMomoPayload,
  verifyMomoIpnSignature,
  type MomoIpnSignatureInput,
} from '../src/payment/momo-signature';
import { createMomoPayment } from '../src/payment/momo-client';

/**
 * Fully offline: global fetch is mocked, every key below is fake. These assertions
 * are the only thing standing between a signing/host mistake and real money going
 * to somebody else's payUrl.
 */

const SECRET = 'test-secret-not-a-credential';

const config: MomoCheckoutConfig = {
  environment: 'sandbox',
  partnerCode: 'MOMOTESTPARTNER',
  accessKey: 'test-access-key',
  secretKey: SECRET,
  createEndpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
  payUrlHost: 'test-payment.momo.vn',
  publicApiUrl: 'https://api.example.test',
  publicWebUrl: 'https://web.example.test',
};

const createInput = {
  orderId: 'GC-ORDER-1',
  requestId: 'GC-REQ-1',
  amount: 50000,
  orderInfo: 'GreenCity subscription 30 ngay',
};

const ipnInput: MomoIpnSignatureInput = {
  accessKey: config.accessKey,
  amount: 50000,
  extraData: '',
  message: 'Successful.',
  orderId: createInput.orderId,
  orderInfo: createInput.orderInfo,
  orderType: 'momo_wallet',
  partnerCode: config.partnerCode,
  payType: 'qr',
  requestId: createInput.requestId,
  responseTime: 1735689600000,
  resultCode: 0,
  transId: 1234567890,
};

const originalFetch = globalThis.fetch;
let calls: Array<{ url: string; init: RequestInit }>;

/** Mocks fetch with a handler; records what the client actually sent. */
function mockFetch(handler: (init: RequestInit) => Promise<Response>): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(init ?? {});
  }) as typeof fetch;
}

function okResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function successBody(overrides: Record<string, unknown> = {}) {
  return {
    partnerCode: config.partnerCode,
    orderId: createInput.orderId,
    requestId: createInput.requestId,
    amount: createInput.amount,
    responseTime: 1735689600000,
    message: 'Successful.',
    resultCode: 0,
    payUrl: 'https://test-payment.momo.vn/pay/store/abc123',
    ...overrides,
  };
}

async function expectPaymentErrorCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getResponse()).toMatchObject({ code });
}

/** Goes through the real env parser, so a renamed MOMO_* field fails here. */
function envWith(overrides: Record<string, string>): AppEnv {
  return loadEnv({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

const FULL_MOMO_ENV = {
  MOMO_ENV: 'sandbox',
  MOMO_PARTNER_CODE: 'MOMOTESTPARTNER',
  MOMO_ACCESS_KEY: 'test-access-key',
  MOMO_SECRET_KEY: SECRET,
  PUBLIC_API_URL: 'https://api.example.test',
  PUBLIC_WEB_URL: 'https://web.example.test',
};

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('momo signature', () => {
  it('builds the canonical create-payment raw string verbatim, unencoded', () => {
    expect(
      buildCreatePaymentRawSignature({
        accessKey: 'AK',
        amount: 50000,
        extraData: '',
        ipnUrl: 'https://api.example.test/payment-webhooks/momo',
        orderId: 'GC-ORDER-1',
        orderInfo: 'GreenCity subscription 30 ngay',
        partnerCode: 'PC',
        redirectUrl: 'https://web.example.test/cho-online',
        requestId: 'GC-REQ-1',
        requestType: 'captureWallet',
      }),
    ).toBe(
      'accessKey=AK&amount=50000&extraData=&ipnUrl=https://api.example.test/payment-webhooks/momo' +
        '&orderId=GC-ORDER-1&orderInfo=GreenCity subscription 30 ngay&partnerCode=PC' +
        '&redirectUrl=https://web.example.test/cho-online&requestId=GC-REQ-1&requestType=captureWallet',
    );
  });

  it('signs with hex HMAC-SHA256 matching an independently computed fixture', () => {
    const raw = 'accessKey=AK&amount=50000';
    const expected = createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');

    expect(signMomoPayload(raw, SECRET)).toBe(expected);
    expect(signMomoPayload(raw, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  // Pinned independently of buildIpnRawSignature/signMomoPayload: the round-trip
  // test above signs with the same function it verifies with, so a field-order
  // bug in both would still pass it. A literal expected string does not have
  // that blind spot.
  it('matches a golden fixture pinned independently of the signing function', () => {
    const raw = buildIpnRawSignature(ipnInput);
    expect(raw).toBe(
      'accessKey=test-access-key&amount=50000&extraData=&message=Successful.' +
        '&orderId=GC-ORDER-1&orderInfo=GreenCity subscription 30 ngay' +
        '&orderType=momo_wallet&partnerCode=MOMOTESTPARTNER&payType=qr' +
        '&requestId=GC-REQ-1&responseTime=1735689600000&resultCode=0' +
        '&transId=1234567890',
    );

    const digest = signMomoPayload(raw, SECRET);
    expect(digest).toBe(
      '8f43ff1f57fd6cca40eb1eff02f1c9efa991f9edc95d17fd361d5011f406a1c7',
    );

    for (const tampered of [
      { ...ipnInput, amount: 1 },
      { ...ipnInput, requestId: 'someone-elses-request' },
      { ...ipnInput, resultCode: 99 },
    ]) {
      expect(verifyMomoIpnSignature(tampered, digest, SECRET)).toBe(false);
    }
  });

  it('accepts a valid IPN signature', () => {
    const valid = signMomoPayload(buildIpnRawSignature(ipnInput), SECRET);
    expect(verifyMomoIpnSignature(ipnInput, valid, SECRET)).toBe(true);
    // Uppercase hex is still the same digest.
    expect(verifyMomoIpnSignature(ipnInput, valid.toUpperCase(), SECRET)).toBe(true);
  });

  it('rejects a non-hex signature', () => {
    expect(verifyMomoIpnSignature(ipnInput, 'z'.repeat(64), SECRET)).toBe(false);
    expect(verifyMomoIpnSignature(ipnInput, '', SECRET)).toBe(false);
  });

  it('rejects a signature of the wrong length', () => {
    const valid = signMomoPayload(buildIpnRawSignature(ipnInput), SECRET);
    expect(verifyMomoIpnSignature(ipnInput, valid.slice(0, 63), SECRET)).toBe(false);
    expect(verifyMomoIpnSignature(ipnInput, `${valid}ab`, SECRET)).toBe(false);
  });

  it('rejects a correct-length but incorrect signature', () => {
    const valid = signMomoPayload(buildIpnRawSignature(ipnInput), SECRET);
    const flipped = (valid[0] === 'a' ? 'b' : 'a') + valid.slice(1);

    expect(flipped).toHaveLength(64);
    expect(verifyMomoIpnSignature(ipnInput, flipped, SECRET)).toBe(false);
    // A tampered field invalidates the same signature.
    expect(
      verifyMomoIpnSignature({ ...ipnInput, amount: 1 }, valid, SECRET),
    ).toBe(false);
  });
});

describe('resolveMomoCheckoutConfig', () => {
  it('returns null with no configuration at all', () => {
    expect(resolveMomoCheckoutConfig(envWith({}))).toBeNull();
  });

  it.each(Object.keys(FULL_MOMO_ENV).filter((key) => key !== 'MOMO_ENV'))(
    'returns null when only %s is missing (partial config is not configured)',
    (missing) => {
      const partial = { ...FULL_MOMO_ENV } as Record<string, string>;
      delete partial[missing];
      expect(resolveMomoCheckoutConfig(envWith(partial))).toBeNull();
    },
  );

  it('returns null when a public URL is not a usable http(s) URL', () => {
    // env.ts rejects this at load time too; the resolver guards it independently
    // because these URLs are handed to a payment provider.
    const hostile = {
      ...envWith(FULL_MOMO_ENV),
      PUBLIC_WEB_URL: 'javascript:alert(1)',
    } as AppEnv;
    expect(resolveMomoCheckoutConfig(hostile)).toBeNull();
  });

  it('normalises a public URL with a trailing slash to a bare origin', () => {
    expect(
      resolveMomoCheckoutConfig(
        envWith({ ...FULL_MOMO_ENV, PUBLIC_API_URL: 'https://api.example.test/' }),
      ),
    ).toMatchObject({ publicApiUrl: 'https://api.example.test' });
  });

  // Cleartext loopback is a local-development convenience. In production these
  // URLs are given to MoMo and carry a payment result back, so http is refused
  // there even on localhost — the same value that is fine for sandbox.
  it.each(['http://localhost:3001', 'http://127.0.0.1:3001'])(
    'refuses %s for the production environment',
    (url) => {
      expect(
        resolveMomoCheckoutConfig(
          envWith({
            ...FULL_MOMO_ENV,
            MOMO_ENV: 'production',
            PUBLIC_API_URL: url,
          }),
        ),
      ).toBeNull();
      expect(
        resolveMomoCheckoutConfig(
          envWith({
            ...FULL_MOMO_ENV,
            MOMO_ENV: 'production',
            PUBLIC_WEB_URL: url,
          }),
        ),
      ).toBeNull();
    },
  );

  it('still accepts http loopback for sandbox development', () => {
    expect(
      resolveMomoCheckoutConfig(
        envWith({
          ...FULL_MOMO_ENV,
          MOMO_ENV: 'sandbox',
          PUBLIC_API_URL: 'http://localhost:3001',
          PUBLIC_WEB_URL: 'http://127.0.0.1:3000',
        }),
      ),
    ).toMatchObject({
      publicApiUrl: 'http://localhost:3001',
      publicWebUrl: 'http://127.0.0.1:3000',
    });
  });

  it('pins sandbox and production endpoints to hard-coded MoMo hosts', () => {
    const sandbox = resolveMomoCheckoutConfig(envWith(FULL_MOMO_ENV));
    expect(sandbox).toMatchObject({
      environment: 'sandbox',
      createEndpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
      payUrlHost: 'test-payment.momo.vn',
    });

    const production = resolveMomoCheckoutConfig(
      envWith({ ...FULL_MOMO_ENV, MOMO_ENV: 'production' }),
    );
    expect(production).toMatchObject({
      environment: 'production',
      createEndpoint: 'https://payment.momo.vn/v2/gateway/api/create',
      payUrlHost: 'payment.momo.vn',
    });
  });
});

describe('createMomoPayment', () => {
  it('returns only validated values for a well-formed sandbox response', async () => {
    mockFetch(() => okResponse(successBody()));

    await expect(createMomoPayment(config, createInput)).resolves.toEqual({
      payUrl: 'https://test-payment.momo.vn/pay/store/abc123',
      momoOrderId: createInput.orderId,
      momoRequestId: createInput.requestId,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(config.createEndpoint);
    expect(call.init.method).toBe('POST');
    expect(call.init.redirect).toBe('error');
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
    expect((call.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json; charset=UTF-8',
    );

    const sent = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    // Pinned to the literal, not to the constant: comparing the payload against
    // MOMO_REQUEST_TYPE passes just as happily when the constant itself is
    // misspelled, and the value is signed, so a typo surfaces only as a
    // signature rejection from MoMo.
    expect(sent.requestType).toBe('captureWallet');
    expect(MOMO_REQUEST_TYPE).toBe('captureWallet');
    // One-step capture, stated explicitly: it is what makes a 9000 result money
    // we hold rather than money merely authorised.
    expect(sent.autoCapture).toBe(true);
    // ...and it must stay out of the signed string, which the docs fix at ten
    // fields. Signing it would make every request fail verification at MoMo.
    expect(String(call.init.body)).toContain('"autoCapture":true');
    expect(sent.signature).toBe(
      signMomoPayload(
        buildCreatePaymentRawSignature({
          accessKey: config.accessKey,
          amount: createInput.amount,
          extraData: '',
          ipnUrl: 'https://api.example.test/payment-webhooks/momo',
          orderId: createInput.orderId,
          orderInfo: createInput.orderInfo,
          partnerCode: config.partnerCode,
          redirectUrl: 'https://web.example.test/cho-online',
          requestId: createInput.requestId,
          requestType: MOMO_REQUEST_TYPE,
        }),
        SECRET,
      ),
    );
    expect(sent.ipnUrl).toBe('https://api.example.test/payment-webhooks/momo');
    expect(sent.redirectUrl).toBe('https://web.example.test/cho-online');
    expect(sent.signature).toMatch(/^[0-9a-f]{64}$/);
    // The secret is never on the wire.
    expect(String(call.init.body)).not.toContain(SECRET);
  });

  it('maps a request timeout to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(() =>
      Promise.reject(
        Object.assign(new Error('The operation was aborted due to timeout'), {
          name: 'TimeoutError',
        }),
      ),
    );

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps a transport failure to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps malformed JSON to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response('<html>gateway</html>', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a valid-JSON but wrong-shape body to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(() => okResponse({ resultCode: '0', payUrl: 42 }));

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a non-zero resultCode to PAYMENT_PROVIDER_REJECTED', async () => {
    mockFetch(() =>
      okResponse(
        successBody({ resultCode: 11, message: 'Access denied', payUrl: undefined }),
      ),
    );

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_REJECTED',
    );
  });

  it('rejects an HTTP redirect instead of following it', async () => {
    mockFetch(() =>
      Promise.reject(new TypeError('unexpected redirect, redirect mode is error')),
    );

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
    expect(calls[0]!.init.redirect).toBe('error');
  });

  it('rejects a mismatched echoed orderId/requestId', async () => {
    mockFetch(() => okResponse(successBody({ orderId: 'SOMEONE-ELSE' })));

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  // A reply naming another merchant, or another sum than the user agreed to,
  // must never reach the point where its payUrl is handed to the browser.
  it.each([
    ['a partnerCode for another merchant', { partnerCode: 'SOMEONE-ELSE' }],
    ['an amount other than the one requested', { amount: 5_000_000 }],
    ['no amount at all', { amount: undefined }],
    ['no partnerCode at all', { partnerCode: undefined }],
    ['a non-integer amount', { amount: 50000.5 }],
  ])(
    'rejects a response with %s',
    async (_label, overrides: Record<string, unknown>) => {
      mockFetch(() => okResponse(successBody(overrides)));

      await expectPaymentErrorCode(
        createMomoPayment(config, createInput),
        'PAYMENT_PROVIDER_UNAVAILABLE',
      );
    },
  );

  it('waits the 30 seconds MoMo documents as the minimum client timeout', async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    mockFetch(() => okResponse(successBody()));

    await createMomoPayment(config, createInput);

    expect(spy).toHaveBeenCalledWith(30_000);
    spy.mockRestore();
  });

  it.each([
    ['javascript:alert(1)'],
    ['http://test-payment.momo.vn/pay/store/abc123'],
    ['https://evil-test-payment.momo.vn/pay/store/abc123'],
    ['https://test-payment.momo.vn.evil.com/pay/store/abc123'],
    ['https://payment.momo.vn/pay/store/abc123'],
    ['https://user:pass@test-payment.momo.vn/pay/store/abc123'],
    // Right host, wrong server.
    ['https://test-payment.momo.vn:444/pay/store/abc123'],
    ['not-a-url'],
    [undefined],
  ])('rejects an unsafe payUrl (%s)', async (payUrl) => {
    mockFetch(() => okResponse(successBody({ payUrl })));

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a non-2xx status to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(() => okResponse(successBody(), 502));

    await expectPaymentErrorCode(
      createMomoPayment(config, createInput),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });
});
