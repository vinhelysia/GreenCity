import type { AppEnv } from '../config/env';

export interface PayosCheckoutConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  publicWebUrl: string;
}

/**
 * Never configurable. A settable endpoint is a money redirect one env var away.
 * payOS publishes a single production host and no sandbox, so unlike the MoMo
 * integration this replaces there is not even an environment to switch on.
 * https://payos.vn/docs/api/
 */
export const PAYOS_API_BASE = 'https://api-merchant.payos.vn';
export const PAYOS_CREATE_ENDPOINT = `${PAYOS_API_BASE}/v2/payment-requests`;

/** Host of data.checkoutUrl: https://pay.payos.vn/web/{paymentLinkId}. */
export const PAYOS_CHECKOUT_HOST = 'pay.payos.vn';

/**
 * Server-to-server callback route. payOS does not take this per request — it is
 * registered once per payment channel through the confirm-webhook API — so
 * renaming this constant silently breaks production until the channel is
 * updated. A test pins the literal for exactly that reason.
 */
export const PAYOS_WEBHOOK_PATH = '/payment-webhooks/payos';

/** Browser return path on the web app; payOS appends its own query params. */
export const PAYOS_RETURN_PATH = '/cho-online';

/**
 * Shown on the transfer and echoed back on the webhook, where it is compared
 * against the value stored on the row.
 *
 * Nine ASCII characters or fewer: payOS documents a nine-character limit for
 * bank accounts that are *not* linked through payOS, and says nothing about a
 * limit for linked ones. Staying under nine satisfies both readings, and ASCII
 * keeps it out of the encoding questions that a signed field invites.
 */
export const PAYOS_DESCRIPTION = 'GCPASS30';

/** payOS envelope code for success — a string, not a number. */
export const PAYOS_SUCCESS_CODE = '00';

/** data.status of a freshly created payment link. */
export const PAYOS_INITIAL_STATUS = 'PENDING';

export const PAYOS_CURRENCY = 'VND';

/**
 * orderCode must be a positive integer that stays exact in JavaScript. payOS
 * does not document an upper bound, so this stays well inside Number.MAX_SAFE_INTEGER
 * rather than probing for the real ceiling.
 */
export const PAYOS_ORDER_CODE_MAX = 9_007_199_254_740_990;

/**
 * Keeps just the origin, so a trailing slash or stray path in the env cannot
 * produce a malformed return link.
 *
 * Cleartext is a local-development affordance and nothing more: it is allowed
 * only on loopback, and never in production, where this URL is handed to payOS.
 */
function returnOrigin(
  value: string | undefined,
  requireHttps: boolean,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return url.origin;
    if (
      !requireHttps &&
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return url.origin;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns null when checkout is not fully configured. Partial configuration is
 * deliberately indistinguishable from none: the caller must never be able to
 * probe which secret is absent.
 */
export function resolvePayosCheckoutConfig(
  env: AppEnv,
): PayosCheckoutConfig | null {
  const clientId = env.PAYOS_CLIENT_ID?.trim();
  const apiKey = env.PAYOS_API_KEY?.trim();
  const checksumKey = env.PAYOS_CHECKSUM_KEY?.trim();
  const publicWebUrl = returnOrigin(
    env.PUBLIC_WEB_URL?.trim(),
    env.NODE_ENV === 'production',
  );

  if (!clientId || !apiKey || !checksumKey || !publicWebUrl) return null;

  return { clientId, apiKey, checksumKey, publicWebUrl };
}
