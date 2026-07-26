import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * payOS signing, transcribed from the official reference implementation at
 * https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/
 * and https://payos.vn/docs/api/ — not from any SDK and not from the MoMo
 * integration this replaces, whose canonical form is unrelated.
 *
 * Two different shapes are signed, and they are NOT interchangeable:
 *  - the create request signs a fixed five-field string (buildCreateRawSignature)
 *  - webhook and response bodies sign an arbitrary object (canonicalizeData)
 *
 * payOS also documents a third, incompatible algorithm for its `payouts` API
 * which percent-encodes values. This module deliberately implements neither
 * that nor anything resembling it: applying it here is a guaranteed mismatch.
 */

/** HMAC-SHA256 hex digest: 64 hex characters / 32 bytes. */
const HEX_HMAC_SHA256 = /^[0-9a-f]{64}$/i;

export interface PayosCreateSignatureInput {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}

/**
 * The five fields payOS documents for the create request, alphabetically
 * ordered, values verbatim — no percent-encoding, no trimming, no reformatting.
 * A value serialised differently here than in the request body is the single
 * most common cause of "Mã kiểm tra(signature) không hợp lệ".
 */
export function buildCreateRawSignature(
  input: PayosCreateSignatureInput,
): string {
  return `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`;
}

function sortObjDataByKey(object: Record<string, unknown>) {
  return Object.keys(object)
    .sort()
    .reduce<Record<string, unknown>>((obj, key) => {
      obj[key] = object[key];
      return obj;
    }, {});
}

/**
 * Canonical query string over a payOS data object.
 *
 * Every quirk below is payOS's, reproduced deliberately — the goal is to agree
 * with their implementation, not to be tidy:
 *  - only the TOP level is sorted, by plain JS sort (UTF-16 ordinal, so `desc`
 *    precedes `description` and uppercase precedes lowercase)
 *  - keys whose value is `undefined` are dropped entirely, so no `key=` appears
 *  - `null` and the literal strings "null"/"undefined" become an empty value,
 *    while empty strings are kept — dropping them is how signatures diverge
 *  - arrays are JSON-stringified with each element's own keys sorted one level,
 *    element order preserved
 *  - the array branch runs BEFORE the null normalisation, so a stringified
 *    array is never null-checked afterwards; the order of these two steps is
 *    load-bearing
 *  - a nested plain object is neither sorted nor stringified: it hits the
 *    template literal and becomes "[object Object]". That is what payOS does.
 *    "Fixing" it would stop us matching them.
 */
export function canonicalizeData(data: Record<string, unknown>): string {
  const sorted = sortObjDataByKey(data);
  return Object.keys(sorted)
    .filter((key) => sorted[key] !== undefined)
    .map((key) => {
      let value: unknown = sorted[key];
      if (value && Array.isArray(value)) {
        value = JSON.stringify(
          value.map((element) =>
            sortObjDataByKey(element as Record<string, unknown>),
          ),
        );
      }
      if (
        value === null ||
        value === undefined ||
        value === 'undefined' ||
        value === 'null'
      ) {
        value = '';
      }
      return `${key}=${String(value)}`;
    })
    .join('&');
}

/** Hashed as UTF-8: payOS signs Vietnamese text in `desc` without escaping it. */
export function signPayosPayload(raw: string, checksumKey: string): string {
  return createHmac('sha256', checksumKey).update(raw, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of the expected signature over a payOS data object
 * against the one the caller sent. Malformed input is rejected before any
 * buffer work, so a hostile body can neither crash the compare nor leak length
 * through an exception. Never logs or returns the signature or the key.
 *
 * The caller must pass the FULL data object exactly as parsed from the body.
 * Stripping unknown keys first — which any non-passthrough Zod schema does —
 * changes the canonical string and rejects genuine callbacks.
 */
export function verifyPayosDataSignature(
  data: Record<string, unknown>,
  provided: string,
  checksumKey: string,
): boolean {
  if (!HEX_HMAC_SHA256.test(provided)) return false;

  const expected = Buffer.from(
    signPayosPayload(canonicalizeData(data), checksumKey),
    'hex',
  );
  const actual = Buffer.from(provided, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
