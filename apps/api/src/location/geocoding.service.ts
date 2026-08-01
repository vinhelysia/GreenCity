import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import type { ReverseGeocodeResult } from '@greencity/shared';
import { loadEnv } from '../config/env';

/**
 * Reverse geocoding through Google, called only from the server.
 *
 * The key never reaches the browser: unlike a Maps JS key, a Geocoding key
 * takes no HTTP-referrer restriction, so publishing one lets anybody spend the
 * project's quota. That is also why this endpoint is authenticated and
 * throttled upstream — it is a paid third-party call wearing our own origin.
 */

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/** A pin drop should not hold the form hostage if Google is slow. */
const TIMEOUT_MS = 8_000;

/**
 * Google's address_components, narrowed to what a Vietnamese address needs.
 * Passthrough: unknown component types are normal and must not fail parsing.
 */
const ComponentSchema = z
  .object({
    long_name: z.string(),
    short_name: z.string(),
    types: z.array(z.string()),
  })
  .passthrough();

const ResponseSchema = z.object({
  status: z.string(),
  results: z
    .array(
      z
        .object({
          formatted_address: z.string().optional(),
          address_components: z.array(ComponentSchema).optional(),
        })
        .passthrough(),
    )
    .optional(),
});

type Component = z.infer<typeof ComponentSchema>;

function pick(components: Component[], type: string): string | null {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

@Injectable()
export class GeocodingService {
  /**
   * Null when no key is configured — the caller turns that into a 503 rather
   * than a 500, because "autofill is off" is a deployment state, not a fault.
   */
  private apiKey(): string | null {
    return loadEnv().GOOGLE_GEOCODING_API_KEY?.trim() || null;
  }

  get configured(): boolean {
    return this.apiKey() !== null;
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult> {
    const key = this.apiKey();
    if (!key) {
      throw new ServiceUnavailableException({
        code: 'GEOCODING_NOT_CONFIGURED',
        message: 'Address lookup is not configured',
      });
    }

    const url = new URL(ENDPOINT);
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', key);
    // Vietnamese component names, since that is what the form expects.
    url.searchParams.set('language', 'vi');

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Never echo the thrown error: the URL carries the API key.
      throw new BadGatewayException({
        code: 'GEOCODING_FAILED',
        message: 'Address lookup failed',
      });
    }

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'GEOCODING_FAILED',
        message: 'Address lookup failed',
      });
    }

    const parsed = ResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new BadGatewayException({
        code: 'GEOCODING_FAILED',
        message: 'Address lookup failed',
      });
    }

    // ZERO_RESULTS is a real answer — open water, a new road — not a failure.
    // Everything else non-OK (OVER_QUERY_LIMIT, REQUEST_DENIED) is ours to fix,
    // and the reporter should not be told which.
    if (parsed.data.status === 'ZERO_RESULTS') {
      return { ward: null, district: null, city: null, addressLine: null };
    }
    if (parsed.data.status !== 'OK') {
      throw new BadGatewayException({
        code: 'GEOCODING_FAILED',
        message: 'Address lookup failed',
      });
    }

    const best = parsed.data.results?.[0];
    const components = best?.address_components ?? [];

    return {
      ward: pick(components, 'administrative_area_level_3') ?? pick(components, 'sublocality_level_1'),
      district: pick(components, 'administrative_area_level_2'),
      city: pick(components, 'administrative_area_level_1'),
      addressLine: best?.formatted_address ?? null,
    };
  }
}
