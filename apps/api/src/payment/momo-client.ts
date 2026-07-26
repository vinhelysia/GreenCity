import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import {
  MOMO_IPN_PATH,
  MOMO_REDIRECT_PATH,
  MOMO_REQUEST_TYPE,
  type MomoCheckoutConfig,
} from './momo-config';
import {
  buildCreatePaymentRawSignature,
  signMomoPayload,
} from './momo-signature';

export interface MomoCreatePaymentResult {
  payUrl: string;
  momoOrderId: string;
  momoRequestId: string;
}

/** MoMo's wallet one-time docs require the client to wait at least 30 seconds. */
const CREATE_TIMEOUT_MS = 30_000;

/**
 * Every field the response is matched on is required. partnerCode and amount
 * are not decoration: without them a reply from the wrong merchant, or for a
 * different sum than we asked for, would be accepted and its payUrl stored.
 */
const CreatePaymentResponseSchema = z.object({
  partnerCode: z.string(),
  orderId: z.string(),
  requestId: z.string(),
  amount: z.number().int().positive(),
  resultCode: z.number().int(),
  payUrl: z.string().optional(),
});

/** Errors carry a shared code only — never a provider body, signature, or key. */
function providerUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'PAYMENT_PROVIDER_UNAVAILABLE',
    message: 'Payment provider is unavailable',
  });
}

function providerRejected(): BadGatewayException {
  return new BadGatewayException({
    code: 'PAYMENT_PROVIDER_REJECTED',
    message: 'Payment provider rejected the request',
  });
}

/**
 * The one URL the browser is sent to. Host must match exactly: a suffix or
 * subdomain match would accept evil-test-payment.momo.vn and
 * test-payment.momo.vn.evil.com alike.
 */
function safePayUrl(payUrl: string | undefined, expectedHost: string): string {
  let url: URL;
  try {
    url = new URL(payUrl ?? '');
  } catch {
    throw providerUnavailable();
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== expectedHost ||
    // A matching hostname on another port is still another server:
    // https://test-payment.momo.vn:444/ is not MoMo's checkout.
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw providerUnavailable();
  }
  return url.toString();
}

export async function createMomoPayment(
  config: MomoCheckoutConfig,
  input: {
    orderId: string;
    requestId: string;
    amount: number;
    orderInfo: string;
    extraData?: string;
  },
): Promise<MomoCreatePaymentResult> {
  const ipnUrl = `${config.publicApiUrl}${MOMO_IPN_PATH}`;
  const redirectUrl = `${config.publicWebUrl}${MOMO_REDIRECT_PATH}`;
  const extraData = input.extraData ?? '';

  const signature = signMomoPayload(
    buildCreatePaymentRawSignature({
      accessKey: config.accessKey,
      amount: input.amount,
      extraData,
      ipnUrl,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      partnerCode: config.partnerCode,
      redirectUrl,
      requestId: input.requestId,
      requestType: MOMO_REQUEST_TYPE,
    }),
    config.secretKey,
  );

  let response: Response;
  try {
    response = await fetch(config.createEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      // A 3xx from a payment endpoint is never legitimate; do not follow it.
      redirect: 'error',
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
      body: JSON.stringify({
        partnerCode: config.partnerCode,
        requestId: input.requestId,
        amount: input.amount,
        orderId: input.orderId,
        orderInfo: input.orderInfo,
        redirectUrl,
        ipnUrl,
        requestType: MOMO_REQUEST_TYPE,
        extraData,
        lang: 'vi',
        // One-step capture, stated rather than assumed: it decides whether a
        // 9000 result is money we have or money merely authorised. Not part of
        // the signature — the documented canonical string does not include it,
        // and adding it there would break the hash.
        autoCapture: true,
        signature,
      }),
    });
  } catch {
    throw providerUnavailable();
  }

  if (!response.ok) throw providerUnavailable();

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw providerUnavailable();
  }

  const parsed = CreatePaymentResponseSchema.safeParse(body);
  if (!parsed.success) throw providerUnavailable();

  if (parsed.data.resultCode !== 0) throw providerRejected();

  // The echoed values are what the IPN will later be matched against, so all
  // four must be the ones we sent. A mismatch means storing a payUrl for
  // another merchant, another order, or another amount than the user agreed to.
  if (
    parsed.data.partnerCode !== config.partnerCode ||
    parsed.data.amount !== input.amount ||
    parsed.data.orderId !== input.orderId ||
    parsed.data.requestId !== input.requestId
  ) {
    throw providerUnavailable();
  }

  return {
    payUrl: safePayUrl(parsed.data.payUrl, config.payUrlHost),
    momoOrderId: parsed.data.orderId,
    momoRequestId: parsed.data.requestId,
  };
}
