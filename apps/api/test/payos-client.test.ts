import {
  buildCreateRawSignature,
  canonicalizeData,
  signPayosPayload,
  verifyPayosDataSignature,
} from '../src/payment/payos-signature';
import {
  PAYOS_CREATE_ENDPOINT,
  PAYOS_DESCRIPTION,
  PAYOS_WEBHOOK_PATH,
  resolvePayosCheckoutConfig,
} from '../src/payment/payos-config';
import { createPayosPayment } from '../src/payment/payos-client';
import type { AppEnv } from '../src/config/env';

/**
 * OFFICIAL DOCUMENTATION TEST DATA — the public sample checksum key published at
 * https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/
 * It is not a credential of this project and grants nothing. No real key is
 * ever used in a test.
 */
const DOC_CHECKSUM_KEY =
  '1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675';

/** The sample webhook `data` object from that same page, verbatim. */
const DOC_WEBHOOK_DATA = {
  orderCode: 123,
  amount: 3000,
  description: 'VQRIO123',
  accountNumber: '12345678',
  reference: 'TF230204212323',
  transactionDateTime: '2023-02-04 18:25:00',
  currency: 'VND',
  paymentLinkId: '124c33293c43417ab7879e14c8d9eb18',
  code: '00',
  desc: 'Thành công',
  counterAccountBankId: '',
  counterAccountBankName: '',
  counterAccountName: '',
  counterAccountNumber: '',
  virtualAccountName: '',
  virtualAccountNumber: '',
};

const DOC_SIGNATURE =
  '412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03';

/**
 * The intermediate canonical string for the fixture above. Pinned as a literal
 * rather than recomputed, because a canonicaliser that is wrong in the same way
 * on both sides of an assertion still agrees with itself.
 */
const DOC_CANONICAL =
  'accountNumber=12345678&amount=3000&code=00&counterAccountBankId=&' +
  'counterAccountBankName=&counterAccountName=&counterAccountNumber=&' +
  'currency=VND&desc=Thành công&description=VQRIO123&orderCode=123&' +
  'paymentLinkId=124c33293c43417ab7879e14c8d9eb18&reference=TF230204212323&' +
  'transactionDateTime=2023-02-04 18:25:00&virtualAccountName=&' +
  'virtualAccountNumber=';

const FAKE_CONFIG = {
  clientId: 'fake-client-id',
  apiKey: 'fake-api-key',
  checksumKey: 'fake-checksum-key-not-a-real-one',
  publicWebUrl: 'https://web.example.test',
};

const RETURN_URL = 'https://web.example.test/cho-online';

describe('payos signature — official documentation fixture', () => {
  it('builds the documented canonical string for the sample webhook data', () => {
    expect(canonicalizeData(DOC_WEBHOOK_DATA)).toBe(DOC_CANONICAL);
  });

  it('reproduces the signature payOS publishes for that data', () => {
    expect(signPayosPayload(DOC_CANONICAL, DOC_CHECKSUM_KEY)).toBe(
      DOC_SIGNATURE,
    );
    expect(
      verifyPayosDataSignature(
        DOC_WEBHOOK_DATA,
        DOC_SIGNATURE,
        DOC_CHECKSUM_KEY,
      ),
    ).toBe(true);
  });

  it('keeps empty-valued keys in the string', () => {
    // The API page shows a second "official" signature for the same payment
    // computed over data without these six keys; only the fixture above is
    // reproducible. Dropping empty values is exactly how the two diverge.
    const withoutEmpties = { ...DOC_WEBHOOK_DATA };
    for (const key of [
      'counterAccountBankId',
      'counterAccountBankName',
      'counterAccountName',
      'counterAccountNumber',
      'virtualAccountName',
      'virtualAccountNumber',
    ]) {
      delete (withoutEmpties as Record<string, unknown>)[key];
    }
    expect(
      verifyPayosDataSignature(
        withoutEmpties,
        DOC_SIGNATURE,
        DOC_CHECKSUM_KEY,
      ),
    ).toBe(false);
  });

  it.each([
    ['amount', { ...DOC_WEBHOOK_DATA, amount: 4000 }],
    ['orderCode', { ...DOC_WEBHOOK_DATA, orderCode: 124 }],
    ['reference', { ...DOC_WEBHOOK_DATA, reference: 'TF000000000000' }],
    ['code', { ...DOC_WEBHOOK_DATA, code: '01' }],
  ])('rejects the documented signature once %s is altered', (_field, data) => {
    expect(verifyPayosDataSignature(data, DOC_SIGNATURE, DOC_CHECKSUM_KEY)).toBe(
      false,
    );
  });
});

describe('payos canonicalisation rules', () => {
  it('sorts top-level keys by code unit, so desc precedes description', () => {
    expect(canonicalizeData({ description: 'b', desc: 'a' })).toBe(
      'desc=a&description=b',
    );
  });

  it('drops keys whose value is undefined but keeps null as empty', () => {
    expect(canonicalizeData({ a: undefined, b: null, c: '' })).toBe('b=&c=');
  });

  it.each([
    ['null string', 'null'],
    ['undefined string', 'undefined'],
  ])('normalises the literal %s to an empty value', (_label, value) => {
    expect(canonicalizeData({ a: value })).toBe('a=');
  });

  it('sorts keys inside array elements but preserves element order', () => {
    expect(
      canonicalizeData({
        items: [
          { quantity: 1, name: 'b' },
          { quantity: 2, name: 'a' },
        ],
      }),
    ).toBe('items=[{"name":"b","quantity":1},{"name":"a","quantity":2}]');
  });

  it('leaves a nested plain object as [object Object], matching payOS', () => {
    // Deliberate: payOS's own reference implementation does this. Serialising
    // it "properly" would stop our signature matching theirs.
    expect(canonicalizeData({ invoice: { taxPercentage: 10 } })).toBe(
      'invoice=[object Object]',
    );
  });

  it('does not percent-encode spaces or Vietnamese text', () => {
    expect(canonicalizeData({ a: 'Thành công 1' })).toBe('a=Thành công 1');
  });
});

describe('payos signature verification hardening', () => {
  const valid = signPayosPayload(
    canonicalizeData(DOC_WEBHOOK_DATA),
    DOC_CHECKSUM_KEY,
  );

  it.each([
    ['empty', ''],
    ['non-hex', 'z'.repeat(64)],
    ['too short', valid.slice(0, 63)],
    ['too long', valid + '0'],
    ['odd length', valid.slice(0, 61)],
  ])('rejects a %s signature without throwing', (_label, provided) => {
    expect(
      verifyPayosDataSignature(DOC_WEBHOOK_DATA, provided, DOC_CHECKSUM_KEY),
    ).toBe(false);
  });

  it('rejects a correct-length signature computed with another key', () => {
    const foreign = signPayosPayload(
      canonicalizeData(DOC_WEBHOOK_DATA),
      'another-key',
    );
    expect(foreign).toMatch(/^[0-9a-f]{64}$/);
    expect(
      verifyPayosDataSignature(DOC_WEBHOOK_DATA, foreign, DOC_CHECKSUM_KEY),
    ).toBe(false);
  });
});

describe('payos create-request signature', () => {
  it('pins the five documented fields in alphabetical order', () => {
    expect(
      buildCreateRawSignature({
        amount: 50000,
        cancelUrl: 'https://w.test/c',
        description: 'GCPASS30',
        orderCode: 1784000000000123,
        returnUrl: 'https://w.test/r',
      }),
    ).toBe(
      'amount=50000&cancelUrl=https://w.test/c&description=GCPASS30' +
        '&orderCode=1784000000000123&returnUrl=https://w.test/r',
    );
  });

  it('keeps the plan description within the nine-character documented limit', () => {
    // payOS documents a nine-character description limit for bank accounts not
    // linked through payOS, and states no limit for linked ones. Staying under
    // nine satisfies both readings.
    expect(PAYOS_DESCRIPTION.length).toBeLessThanOrEqual(9);
    expect(PAYOS_DESCRIPTION).toMatch(/^[\x20-\x7e]+$/);
  });
});

describe('payos endpoints are hard-coded', () => {
  it('pins the create endpoint to payOS production', () => {
    expect(PAYOS_CREATE_ENDPOINT).toBe(
      'https://api-merchant.payos.vn/v2/payment-requests',
    );
  });

  it('pins the webhook path, which is registered with payOS out of band', () => {
    // A silent rename here is a production outage nothing else would catch:
    // the address lives in the payOS channel configuration, not in a request.
    expect(PAYOS_WEBHOOK_PATH).toBe('/payment-webhooks/payos');
  });
});

describe('resolvePayosCheckoutConfig', () => {
  const full = {
    NODE_ENV: 'test',
    PAYOS_CLIENT_ID: 'fake-client-id',
    PAYOS_API_KEY: 'fake-api-key',
    PAYOS_CHECKSUM_KEY: 'fake-checksum-key',
    PUBLIC_WEB_URL: 'https://web.example.test',
  } as unknown as AppEnv;

  it('returns null with no configuration at all', () => {
    expect(resolvePayosCheckoutConfig({ NODE_ENV: 'test' } as AppEnv)).toBeNull();
  });

  it.each([
    'PAYOS_CLIENT_ID',
    'PAYOS_API_KEY',
    'PAYOS_CHECKSUM_KEY',
    'PUBLIC_WEB_URL',
  ])('returns null when only %s is missing', (key) => {
    const env = { ...full } as Record<string, unknown>;
    delete env[key];
    expect(resolvePayosCheckoutConfig(env as AppEnv)).toBeNull();
  });

  it('normalises a public URL with a trailing slash to a bare origin', () => {
    const config = resolvePayosCheckoutConfig({
      ...full,
      PUBLIC_WEB_URL: 'https://web.example.test/',
    } as AppEnv);
    expect(config?.publicWebUrl).toBe('https://web.example.test');
  });

  it('refuses a cleartext public URL in production', () => {
    expect(
      resolvePayosCheckoutConfig({
        ...full,
        NODE_ENV: 'production',
        PUBLIC_WEB_URL: 'http://web.example.test',
      } as AppEnv),
    ).toBeNull();
  });

  it('still accepts http loopback outside production', () => {
    expect(
      resolvePayosCheckoutConfig({
        ...full,
        PUBLIC_WEB_URL: 'http://localhost:3000',
      } as AppEnv),
    ).not.toBeNull();
  });
});

/** Records every outbound call so the request itself can be asserted. */
function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input: any, init: any) => {
      calls.push({ url: String(input), init });
      return impl(String(input), init);
    });
  return { calls, spy };
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const LINK_ID = '124c33293c43417ab7879e14c8d9eb18';

function successBody(overrides: Record<string, unknown> = {}) {
  return {
    code: '00',
    desc: 'success',
    data: {
      bin: '970422',
      accountNumber: '0011000000000',
      accountName: 'GREENCITY',
      amount: 50000,
      description: PAYOS_DESCRIPTION,
      orderCode: 1784000000000123,
      currency: 'VND',
      paymentLinkId: LINK_ID,
      status: 'PENDING',
      checkoutUrl: `https://pay.payos.vn/web/${LINK_ID}`,
      qrCode: '00020101021238...',
      ...overrides,
    },
  };
}

/**
 * A provider response as payOS actually sends one. Every happy-path fixture
 * goes through this: the client now refuses an unsigned success envelope, so a
 * fixture without a signature would make a test pass or fail for the wrong
 * reason. Signed over the raw data object, including the keys the client does
 * not model.
 */
function signedBody(overrides: Record<string, unknown> = {}) {
  const body = successBody(overrides);
  return {
    ...body,
    signature: signPayosPayload(
      canonicalizeData(body.data as Record<string, unknown>),
      FAKE_CONFIG.checksumKey,
    ),
  };
}

async function expectPaymentErrorCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ response: { code } });
}

const CREATE_INPUT = {
  orderCode: 1784000000000123,
  amount: 50000,
  description: PAYOS_DESCRIPTION,
};

describe('createPayosPayment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the documented endpoint, headers and signed body', async () => {
    const { calls } = mockFetch(async () => okResponse(signedBody()));

    const result = await createPayosPayment(FAKE_CONFIG, CREATE_INPUT);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://api-merchant.payos.vn/v2/payment-requests');
    expect(call.init.method).toBe('POST');
    expect(call.init.redirect).toBe('error');
    expect(call.init.signal).toBeInstanceOf(AbortSignal);

    const headers = call.init.headers as Record<string, string>;
    expect(headers['x-client-id']).toBe(FAKE_CONFIG.clientId);
    expect(headers['x-api-key']).toBe(FAKE_CONFIG.apiKey);
    expect(headers['Content-Type']).toBe('application/json; charset=UTF-8');
    // The checksum key signs; it is never transmitted.
    expect(JSON.stringify(headers)).not.toContain(FAKE_CONFIG.checksumKey);

    const sent = JSON.parse(String(call.init.body));
    expect(sent).toMatchObject({
      orderCode: CREATE_INPUT.orderCode,
      amount: CREATE_INPUT.amount,
      description: PAYOS_DESCRIPTION,
      returnUrl: RETURN_URL,
      cancelUrl: RETURN_URL,
    });
    expect(String(call.init.body)).not.toContain(FAKE_CONFIG.checksumKey);

    // Recomputed from the literal canonical form, not from the production
    // builder, so a field-order change cannot pass by agreeing with itself.
    expect(sent.signature).toBe(
      signPayosPayload(
        `amount=50000&cancelUrl=${RETURN_URL}&description=${PAYOS_DESCRIPTION}` +
          `&orderCode=${CREATE_INPUT.orderCode}&returnUrl=${RETURN_URL}`,
        FAKE_CONFIG.checksumKey,
      ),
    );

    expect(result).toEqual({
      payUrl: 'https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18',
      providerPaymentId: '124c33293c43417ab7879e14c8d9eb18',
    });
  });

  it('maps a request timeout to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(async () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    });
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a transport failure to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps malformed JSON to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(
      async () =>
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a valid-JSON but wrong-shape body to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(async () => okResponse({ code: '00', data: { nope: true } }));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a non-2xx status to PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    mockFetch(async () => okResponse(signedBody(), 500));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('maps a non-"00" envelope code to PAYMENT_PROVIDER_REJECTED', async () => {
    mockFetch(async () =>
      okResponse({ ...signedBody(), code: '231', desc: 'invalid' }),
    );
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_REJECTED',
    );
  });

  it('rejects an HTTP redirect instead of following it', async () => {
    const { calls } = mockFetch(async () => {
      throw new TypeError('unexpected redirect');
    });
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
    expect(calls[0]!.init.redirect).toBe('error');
  });

  it.each([
    ['orderCode', { orderCode: 999 }],
    ['amount', { amount: 1 }],
    ['description', { description: 'OTHER' }],
    ['currency', { currency: 'USD' }],
    ['status', { status: 'PAID' }],
  ])('rejects a response whose echoed %s is not ours', async (_f, override) => {
    mockFetch(async () => okResponse(signedBody(override)));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it.each([
    ['http scheme', `http://pay.payos.vn/web/${LINK_ID}`],
    ['a foreign host', `https://evil.test/web/${LINK_ID}`],
    ['a suffix host', `https://pay.payos.vn.evil.test/web/${LINK_ID}`],
    ['a prefixed host', `https://evilpay.payos.vn/web/${LINK_ID}`],
    ['a subdomain', `https://a.pay.payos.vn/web/${LINK_ID}`],
    ['a non-default port', `https://pay.payos.vn:8443/web/${LINK_ID}`],
    ['embedded credentials', `https://u:p@pay.payos.vn/web/${LINK_ID}`],
    ['a relative url', `/web/${LINK_ID}`],
    ['a javascript url', 'javascript:alert(1)'],
  ])('rejects an unsafe checkoutUrl (%s)', async (_label, checkoutUrl) => {
    mockFetch(async () => okResponse(signedBody({ checkoutUrl })));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it.each([
    ['another payment link on the real host', 'https://pay.payos.vn/web/someone-else'],
    ['a bare host', 'https://pay.payos.vn/'],
    ['a different path shape', `https://pay.payos.vn/pay/${LINK_ID}`],
    ['the link as a query parameter', `https://pay.payos.vn/web/other?id=${LINK_ID}`],
    ['a trailing segment', `https://pay.payos.vn/web/${LINK_ID}/extra`],
  ])(
    'rejects a checkoutUrl not bound to the returned paymentLinkId (%s)',
    async (_label, checkoutUrl) => {
      // The host being genuinely payOS is not enough: this is a real payOS
      // page collecting money against an order that is not ours, and no
      // webhook for it would ever match this row.
      mockFetch(async () => okResponse(signedBody({ checkoutUrl })));
      await expectPaymentErrorCode(
        createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
        'PAYMENT_PROVIDER_UNAVAILABLE',
      );
    },
  );

  it('allows query parameters payOS appends to its own checkout path', async () => {
    mockFetch(async () =>
      okResponse(
        signedBody({ checkoutUrl: `https://pay.payos.vn/web/${LINK_ID}?lang=vi` }),
      ),
    );
    await expect(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
    ).resolves.toMatchObject({
      payUrl: `https://pay.payos.vn/web/${LINK_ID}?lang=vi`,
    });
  });

  it('rejects a success envelope carrying no signature at all', async () => {
    // Fail closed. An unsigned body cannot be attributed to payOS, and their
    // own SDKs verify this response before returning a checkout link.
    mockFetch(async () => okResponse(successBody()));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it.each([
    ['a wrong-but-well-formed signature', 'a'.repeat(64)],
    ['a non-hex signature', 'z'.repeat(64)],
    ['a truncated signature', 'a'.repeat(63)],
  ])('rejects a response with %s', async (_label, signature) => {
    mockFetch(async () => okResponse({ ...successBody(), signature }));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('rejects a signature that covers a tampered copy of the data', async () => {
    // Signed correctly, but for a different amount than the one delivered:
    // proves the signature is checked against the body actually received.
    const delivered = successBody();
    const signature = signPayosPayload(
      canonicalizeData({ ...delivered.data, amount: 1 }),
      FAKE_CONFIG.checksumKey,
    );
    mockFetch(async () => okResponse({ ...delivered, signature }));
    await expectPaymentErrorCode(
      createPayosPayment(FAKE_CONFIG, CREATE_INPUT),
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });
});
