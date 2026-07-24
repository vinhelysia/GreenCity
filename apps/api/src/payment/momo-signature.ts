import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * MoMo signs a fixed, alphabetically ordered key=value string joined by "&".
 * Values are used verbatim — no URL-encoding — so each canonical string below
 * is written out exactly once; correcting it against the docs is a one-liner.
 */

export interface MomoCreateSignatureInput {
  accessKey: string;
  amount: number | string;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}

export interface MomoIpnSignatureInput {
  accessKey: string;
  amount: number | string;
  extraData: string;
  message: string;
  orderId: string;
  orderInfo: string;
  orderType: string;
  partnerCode: string;
  payType: string;
  requestId: string;
  responseTime: number | string;
  resultCode: number | string;
  transId: number | string;
}

/** HMAC-SHA256 hex digest: 64 hex characters / 32 bytes. */
const HEX_HMAC_SHA256 = /^[0-9a-f]{64}$/i;

export function buildCreatePaymentRawSignature(
  input: MomoCreateSignatureInput,
): string {
  return `accessKey=${input.accessKey}&amount=${input.amount}&extraData=${input.extraData}&ipnUrl=${input.ipnUrl}&orderId=${input.orderId}&orderInfo=${input.orderInfo}&partnerCode=${input.partnerCode}&redirectUrl=${input.redirectUrl}&requestId=${input.requestId}&requestType=${input.requestType}`;
}

export function buildIpnRawSignature(input: MomoIpnSignatureInput): string {
  return `accessKey=${input.accessKey}&amount=${input.amount}&extraData=${input.extraData}&message=${input.message}&orderId=${input.orderId}&orderInfo=${input.orderInfo}&orderType=${input.orderType}&partnerCode=${input.partnerCode}&payType=${input.payType}&requestId=${input.requestId}&responseTime=${input.responseTime}&resultCode=${input.resultCode}&transId=${input.transId}`;
}

export function signMomoPayload(raw: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(raw, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of the expected IPN signature against the one the
 * caller sent. Malformed input is rejected before any buffer work, so a hostile
 * body can neither crash the compare nor leak length through an exception.
 * Never logs or returns the signature or the secret.
 */
export function verifyMomoIpnSignature(
  input: MomoIpnSignatureInput,
  provided: string,
  secretKey: string,
): boolean {
  if (!HEX_HMAC_SHA256.test(provided)) return false;

  const expected = Buffer.from(
    signMomoPayload(buildIpnRawSignature(input), secretKey),
    'hex',
  );
  const actual = Buffer.from(provided, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
