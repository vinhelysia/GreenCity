import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import {
  PAYOS_CHECKOUT_HOST,
  PAYOS_CREATE_ENDPOINT,
  PAYOS_CURRENCY,
  PAYOS_INITIAL_STATUS,
  PAYOS_RETURN_PATH,
  PAYOS_SUCCESS_CODE,
  type PayosCheckoutConfig,
} from './payos-config';
import {
  buildCreateRawSignature,
  signPayosPayload,
  verifyPayosDataSignature,
} from './payos-signature';

export interface PayosCreatePaymentResult {
  payUrl: string;
  /** payOS paymentLinkId — stored so the webhook can be matched against it. */
  providerPaymentId: string;
}

/**
 * payOS documents no minimum client timeout, so this is our choice rather than
 * theirs: long enough to survive a slow gateway, short enough that a checkout
 * click does not hang. Whatever happens after it, the payment row stays
 * PENDING — payOS may have accepted the order regardless.
 */
const CREATE_TIMEOUT_MS = 20_000;

/**
 * Only the fields the response is matched on are required, and the object is
 * passthrough so unknown keys survive for the signature check.
 */
const CreateResponseDataSchema = z
  .object({
    orderCode: z.number().int().safe(),
    amount: z.number().int(),
    description: z.string(),
    currency: z.string(),
    paymentLinkId: z.string().min(1),
    status: z.string(),
    checkoutUrl: z.string(),
  })
  .passthrough();

const CreateResponseSchema = z.object({
  code: z.string(),
  desc: z.string().optional(),
  data: CreateResponseDataSchema.nullish(),
  signature: z.string().optional(),
});

const RecoverResponseDataSchema = z
  .object({
    id: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/),
    orderCode: z.number().int().safe(),
    amount: z.number().int(),
    status: z.string(),
  })
  .passthrough();

const RecoverResponseSchema = z.object({
  code: z.string(),
  desc: z.string().optional(),
  data: RecoverResponseDataSchema.nullish(),
  signature: z.string().optional(),
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
 * The one URL the browser is sent to.
 *
 * Host must match exactly: a suffix or subdomain match would accept
 * evil-pay.payos.vn and pay.payos.vn.evil.com alike. A matching hostname on
 * another port is still another server, and embedded credentials would leak
 * into the address bar.
 *
 * The path is bound to the payment link this response claims to be for.
 * Checking only the host would accept https://pay.payos.vn/web/<another-link>:
 * a genuine payOS page, on the genuine payOS host, collecting money against an
 * order that is not the one we created and will never be reconciled against
 * this row. Query parameters stay allowed — payOS appends its own.
 */
function safeCheckoutUrl(checkoutUrl: string, paymentLinkId: string): string {
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    throw providerUnavailable();
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== PAYOS_CHECKOUT_HOST ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== `/web/${paymentLinkId}`
  ) {
    throw providerUnavailable();
  }
  return url.toString();
}

export async function createPayosPayment(
  config: PayosCheckoutConfig,
  input: { orderCode: number; amount: number; description: string },
): Promise<PayosCreatePaymentResult> {
  const returnUrl = `${config.publicWebUrl}${PAYOS_RETURN_PATH}`;
  // payOS requires both. Cancelling lands the reader back where they started;
  // nothing about that page trusts the query string payOS appends to it.
  const cancelUrl = returnUrl;

  const signature = signPayosPayload(
    buildCreateRawSignature({
      amount: input.amount,
      cancelUrl,
      description: input.description,
      orderCode: input.orderCode,
      returnUrl,
    }),
    config.checksumKey,
  );

  let response: Response;
  try {
    response = await fetch(PAYOS_CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-client-id': config.clientId,
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      // A 3xx from a payment endpoint is never legitimate; do not follow it.
      redirect: 'error',
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
      // Serialised exactly as signed above — same numbers, same strings, no
      // encoding applied on either side.
      body: JSON.stringify({
        orderCode: input.orderCode,
        amount: input.amount,
        description: input.description,
        returnUrl,
        cancelUrl,
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

  const parsed = CreateResponseSchema.safeParse(body);
  if (!parsed.success) throw providerUnavailable();

  // A non-"00" envelope is payOS answering "no" — a different thing from payOS
  // being unreachable, and a different error for the reader.
  if (parsed.data.code !== PAYOS_SUCCESS_CODE) throw providerRejected();
  if (!parsed.data.data) throw providerUnavailable();

  const data = parsed.data.data;

  // Fail closed: a success envelope carrying no signature is not something we
  // can attribute to payOS, so it is treated as the provider being unusable
  // rather than trusted. payOS signs the create response and its own SDKs
  // verify it; an unsigned body is either not payOS or not intact, and both
  // answers are "do not send a payer to this URL".
  //
  // Checked before any field of `data` is read, and over the raw object as
  // received rather than a stripped copy: the canonical string covers every key
  // payOS sent, including ones this client does not model. Nothing below —
  // paymentLinkId, checkoutUrl, amount, orderCode, description, currency,
  // status — is trusted until this passes.
  const rawData = (body as { data?: Record<string, unknown> }).data;
  if (
    !parsed.data.signature ||
    !rawData ||
    !verifyPayosDataSignature(
      rawData,
      parsed.data.signature,
      config.checksumKey,
    )
  ) {
    throw providerUnavailable();
  }

  // The echoed values decide what the webhook is later matched against, so all
  // of them must be the ones we asked for. A mismatch means storing a checkout
  // link for another order, another sum, or an already-settled payment.
  if (
    data.orderCode !== input.orderCode ||
    data.amount !== input.amount ||
    data.description !== input.description ||
    data.currency !== PAYOS_CURRENCY ||
    data.status !== PAYOS_INITIAL_STATUS
  ) {
    throw providerUnavailable();
  }

  return {
    payUrl: safeCheckoutUrl(data.checkoutUrl, data.paymentLinkId),
    providerPaymentId: data.paymentLinkId,
  };
}

/**
 * Recovers a link when create may have reached payOS but its response did not
 * reach us. The merchant orderCode is stable, so this never creates a second
 * payment request.
 */
export async function recoverPayosPayment(
  config: PayosCheckoutConfig,
  input: { orderCode: number; amount: number },
): Promise<PayosCreatePaymentResult | null> {
  let response: Response;
  try {
    response = await fetch(`${PAYOS_CREATE_ENDPOINT}/${input.orderCode}`, {
      method: 'GET',
      headers: {
        'x-client-id': config.clientId,
        'x-api-key': config.apiKey,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });
  } catch {
    throw providerUnavailable();
  }

  // A concurrent retry can arrive before payOS has indexed the create request.
  if (response.status === 404) return null;
  if (!response.ok) throw providerUnavailable();

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw providerUnavailable();
  }

  const parsed = RecoverResponseSchema.safeParse(body);
  if (!parsed.success) throw providerUnavailable();
  if (parsed.data.code !== PAYOS_SUCCESS_CODE) return null;
  if (!parsed.data.data) throw providerUnavailable();

  const rawData = (body as { data?: Record<string, unknown> }).data;
  if (
    !parsed.data.signature ||
    !rawData ||
    !verifyPayosDataSignature(
      rawData,
      parsed.data.signature,
      config.checksumKey,
    )
  ) {
    throw providerUnavailable();
  }

  const data = parsed.data.data;
  if (
    data.orderCode !== input.orderCode ||
    data.amount !== input.amount ||
    data.status !== PAYOS_INITIAL_STATUS
  ) {
    throw providerUnavailable();
  }

  return {
    payUrl: safeCheckoutUrl(
      `https://${PAYOS_CHECKOUT_HOST}/web/${data.id}`,
      data.id,
    ),
    providerPaymentId: data.id,
  };
}
