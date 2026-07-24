import type { AppEnv } from '../config/env';

export type MomoEnvironment = 'sandbox' | 'production';

export interface MomoCheckoutConfig {
  environment: MomoEnvironment;
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  createEndpoint: string;
  payUrlHost: string;
  publicApiUrl: string;
  publicWebUrl: string;
}

/**
 * Never configurable. A settable endpoint or payUrl host is a money redirect
 * one env var away; both are pinned here per environment instead.
 */
const MOMO_ENDPOINTS: Record<
  MomoEnvironment,
  { createEndpoint: string; payUrlHost: string }
> = {
  sandbox: {
    createEndpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
    payUrlHost: 'test-payment.momo.vn',
  },
  production: {
    createEndpoint: 'https://payment.momo.vn/v2/gateway/api/create',
    payUrlHost: 'payment.momo.vn',
  },
};

/**
 * MoMo one-shot wallet capture. Single source of truth for the payload +
 * signature. The value is `captureWallet`: it is signed as well as sent, so a
 * wrong spelling here fails the signature check rather than erroring clearly.
 */
export const MOMO_REQUEST_TYPE = 'captureWallet';

/** Server-to-server IPN route on the API (see the webhook controller). */
export const MOMO_IPN_PATH = '/payment-webhooks/momo';

/**
 * Browser return path on the web app; MoMo appends its own query params.
 * ponytail: one constant, not an input — change this line if checkout ever
 * needs a dedicated result page instead of the marketplace it unlocks.
 */
export const MOMO_REDIRECT_PATH = '/cho-online';

/**
 * Keeps just the origin, so a trailing slash or stray path in the env cannot
 * produce a malformed callback link.
 *
 * Cleartext is a local-development affordance and nothing more: it is allowed
 * only on loopback, and never in production, where these URLs are handed to
 * MoMo and carry a payment result back.
 */
function callbackOrigin(
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
export function resolveMomoCheckoutConfig(
  env: AppEnv,
): MomoCheckoutConfig | null {
  const environment: MomoEnvironment =
    env.MOMO_ENV === 'production' ? 'production' : 'sandbox';

  const partnerCode = env.MOMO_PARTNER_CODE?.trim();
  const accessKey = env.MOMO_ACCESS_KEY?.trim();
  const secretKey = env.MOMO_SECRET_KEY?.trim();
  const requireHttps = environment === 'production';
  const publicApiUrl = callbackOrigin(env.PUBLIC_API_URL?.trim(), requireHttps);
  const publicWebUrl = callbackOrigin(env.PUBLIC_WEB_URL?.trim(), requireHttps);

  if (
    !partnerCode ||
    !accessKey ||
    !secretKey ||
    !publicApiUrl ||
    !publicWebUrl
  ) {
    return null;
  }

  return {
    environment,
    partnerCode,
    accessKey,
    secretKey,
    ...MOMO_ENDPOINTS[environment],
    publicApiUrl,
    publicWebUrl,
  };
}
