import { BadGatewayException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ReverseGeocodeResult } from '@greencity/shared';

/**
 * Reverse geocoding through OpenStreetMap's Nominatim.
 *
 * Chosen over Google Geocoding because it needs no API key, no billing account
 * and no payment card. It is called only from the server: the endpoint in front
 * of it is authenticated so this cannot become a free public geocoding proxy
 * running on our IP's Nominatim reputation.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

/** A pin drop should not hold the form hostage if Nominatim is slow. */
const TIMEOUT_MS = 8_000;

/**
 * Nominatim's usage policy caps absolute maximum 1 request/second, and blocks
 * clients that ignore it. Their other hard requirement is a User-Agent that
 * identifies the application — a generic or absent one is refused.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const MIN_INTERVAL_MS = 1_100;
const USER_AGENT = 'GreenCity/1.0 (https://green-city-web.vercel.app)';

/**
 * Serialised outbound gate.
 *
 * A bare "last call timestamp" check is not enough: two requests arriving in
 * the same tick both read the same timestamp, both compute the same wait, and
 * both fire together — exactly the burst the policy forbids. Chaining every
 * call onto the previous one is what actually guarantees the spacing.
 *
 * ponytail: in-process, which is correct while the API is a single Render
 * instance. Scaling past one instance needs a shared limiter (Redis), because
 * the cap is per-IP at Nominatim, not per-process.
 */
let chain: Promise<unknown> = Promise.resolve();
let lastStartedAt = 0;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function resetGeocodingGateForTests(): void {
  chain = Promise.resolve();
  lastStartedAt = 0;
}

/** Exported for tests: the spacing guarantee is the part worth pinning. */
export function schedule<T>(
  run: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  now: () => number = Date.now,
): Promise<T> {
  const result = chain.then(async () => {
    const wait = lastStartedAt + MIN_INTERVAL_MS - now();
    if (wait > 0) await sleep(wait);
    lastStartedAt = now();
    return run();
  });
  // Keep the chain alive after a rejection, or one failure stalls every
  // later lookup forever.
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Which key holds a ward or a district varies by how the area was mapped in
 * OSM, so each field tries several in priority order rather than assuming one.
 * Passthrough: unknown keys are normal and must not fail parsing.
 */
const AddressSchema = z
  .object({
    quarter: z.string().optional(),
    suburb: z.string().optional(),
    village: z.string().optional(),
    ward: z.string().optional(),
    city_district: z.string().optional(),
    district: z.string().optional(),
    county: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    state: z.string().optional(),
  })
  .passthrough();

const ResponseSchema = z
  .object({
    display_name: z.string().optional(),
    address: AddressSchema.optional(),
    /** Nominatim reports "Unable to geocode" in-band with HTTP 200. */
    error: z.string().optional(),
  })
  .passthrough();

const clean = (v: string | undefined): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

const first = (...values: (string | undefined)[]): string | null =>
  values.map(clean).find((v) => v !== null) ?? null;

/**
 * In a Vietnamese place name the prefix *is* the administrative level, and it
 * is more trustworthy than the OSM key it arrived under.
 *
 * That matters because Nominatim's keys do not line up with Vietnam's tiers:
 * a real lookup in Củ Chi returns the commune "Xã Nhuận Đức" under
 * `city_district`, while central districts return the ward under `suburb`.
 * Trusting the key alone puts a commune in the district box.
 */
// Anchored with an explicit space rather than \b: JavaScript's \b is defined
// over ASCII word characters, so it never fires after "Xã" or "Thị xã" (both
// end in a non-ASCII letter) while happening to work after "Phường". That
// asymmetry silently dropped every commune-level address.
const WARD_PREFIX = /^(Phường|Xã|Thị trấn)(\s|$)/iu;
const DISTRICT_PREFIX = /^(Quận|Huyện|Thị xã)(\s|$)/iu;

const firstMatching = (
  pattern: RegExp,
  ...values: (string | undefined)[]
): string | null =>
  values.map(clean).find((v) => v !== null && pattern.test(v)) ?? null;

/** Exported for tests: the mapping is the part worth pinning, not the fetch. */
export function toReverseGeocodeResult(
  payload: z.infer<typeof ResponseSchema>,
): ReverseGeocodeResult {
  const a = payload.address ?? {};

  // Prefer whichever value actually reads as a ward, wherever it arrived;
  // fall back to the conventional keys when nothing carries a prefix.
  const ward =
    firstMatching(
      WARD_PREFIX,
      a.quarter,
      a.suburb,
      a.village,
      a.ward,
      a.city_district,
    ) ?? first(a.quarter, a.suburb, a.village, a.ward);

  // Since the 2025 reform most addresses have no district tier at all, so null
  // here is the common, correct answer rather than a failed lookup.
  const district =
    firstMatching(DISTRICT_PREFIX, a.city_district, a.district, a.county) ??
    first(a.district, a.county);

  return {
    ward,
    district: district === ward ? null : district,
    city: first(a.city, a.town, a.state),
    addressLine: clean(payload.display_name),
  };
}

const EMPTY: ReverseGeocodeResult = {
  ward: null,
  district: null,
  city: null,
  addressLine: null,
};

@Injectable()
export class GeocodingService {
  // No constructor dependencies on purpose: Nest resolves constructor params
  // from the container, and a bare function parameter would fail to resolve at
  // boot. The rate gate is tested directly through the exported `schedule`.

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult> {
    const url = new URL(ENDPOINT);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    // Vietnamese place names, since that is what the form expects.
    url.searchParams.set('accept-language', 'vi');

    const response = await schedule(() =>
      fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ).catch(() => null);

    if (!response || !response.ok) {
      throw new BadGatewayException({
        code: 'GEOCODING_FAILED',
        message: 'Address lookup failed',
      });
    }

    const parsed = ResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new BadGatewayException({
        code: 'GEOCODING_FAILED',
        message: 'Address lookup failed',
      });
    }

    // A point in open water resolves to nothing. That is a real answer, not a
    // fault: the reporter keeps their coordinates and types the address.
    if (parsed.data.error) return EMPTY;

    return toReverseGeocodeResult(parsed.data);
  }
}
