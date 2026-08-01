import {
  resetGeocodingGateForTests,
  schedule,
  toReverseGeocodeResult,
} from './geocoding.service';

/**
 * Two things here are worth pinning, and neither is the fetch call.
 *
 * The address mapping, because which OSM key holds a ward or a district varies
 * by how the area was mapped — getting it wrong silently fills the form with
 * the wrong administrative level. And the outbound spacing, because violating
 * Nominatim's 1 request/second policy gets the whole deployment blocked.
 */
describe('geocoding: address mapping', () => {
  // The three payloads below are real Nominatim responses, captured live.
  // Invented fixtures hid the actual behaviour: Nominatim has no `quarter` for
  // these points, and returns a commune under `city_district`.

  it('reads a central HCMC ward from `suburb`', () => {
    expect(
      toReverseGeocodeResult({
        display_name:
          '63, Lý Tự Trọng, Phường Sài Gòn, Thành phố Thủ Đức, Thành phố Hồ Chí Minh, 71006, Việt Nam',
        address: {
          suburb: 'Phường Sài Gòn',
          city: 'Thành phố Thủ Đức',
        },
      }),
    ).toMatchObject({
      ward: 'Phường Sài Gòn',
      district: null,
      city: 'Thành phố Thủ Đức',
    });
  });

  it('treats a commune under `city_district` as a ward, not a district', () => {
    // Real Củ Chi response. Trusting the key name alone would file
    // "Xã Nhuận Đức" as a district, which is a whole tier wrong.
    expect(
      toReverseGeocodeResult({
        address: {
          city_district: 'Xã Nhuận Đức',
          city: 'Thành phố Hồ Chí Minh',
        },
      }),
    ).toMatchObject({
      ward: 'Xã Nhuận Đức',
      district: null,
      city: 'Thành phố Hồ Chí Minh',
    });
  });

  it('still reads a genuine district when one is present', () => {
    // Older-style address: the prefix marks it as a real district tier.
    expect(
      toReverseGeocodeResult({
        address: {
          suburb: 'Phường Bến Nghé',
          city_district: 'Quận 1',
          city: 'Thành phố Hồ Chí Minh',
        },
      }),
    ).toMatchObject({
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'Thành phố Hồ Chí Minh',
    });
  });

  it('never repeats the same name as both ward and district', () => {
    expect(
      toReverseGeocodeResult({ address: { city_district: 'Xã Nhuận Đức' } }),
    ).toMatchObject({ ward: 'Xã Nhuận Đức', district: null });
  });

  it('returns nulls rather than empty strings when nothing resolves', () => {
    // Null means "unknown" to the form, which then leaves the field alone.
    // An empty string would overwrite what the reporter typed.
    expect(toReverseGeocodeResult({})).toEqual({
      ward: null,
      district: null,
      city: null,
      addressLine: null,
    });
    expect(
      toReverseGeocodeResult({ address: { quarter: '   ' }, display_name: '' }),
    ).toEqual({ ward: null, district: null, city: null, addressLine: null });
  });
});

describe('geocoding: Nominatim rate gate', () => {
  beforeEach(() => resetGeocodingGateForTests());

  it('spaces consecutive calls by at least the policy interval', async () => {
    let clock = 10_000;
    const slept: number[] = [];
    const now = () => clock;
    const sleep = async (ms: number) => {
      slept.push(ms);
      clock += ms;
    };

    const startedAt: number[] = [];
    const call = () =>
      schedule(
        async () => {
          startedAt.push(clock);
          return 'ok';
        },
        sleep,
        now,
      );

    // Fired together, the way concurrent form submissions arrive.
    await Promise.all([call(), call(), call()]);

    expect(startedAt).toHaveLength(3);
    for (let i = 1; i < startedAt.length; i++) {
      const gap = startedAt[i]! - startedAt[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(1_100);
    }
    // The first call should not have waited.
    expect(slept.filter((ms) => ms > 0)).toHaveLength(2);
  });

  it('keeps serving later calls after one fails', async () => {
    // A rejection must not stall the chain forever.
    let clock = 0;
    const now = () => clock;
    const sleep = async (ms: number) => {
      clock += ms;
    };

    await expect(
      schedule(() => Promise.reject(new Error('upstream down')), sleep, now),
    ).rejects.toThrow('upstream down');

    await expect(schedule(async () => 'recovered', sleep, now)).resolves.toBe(
      'recovered',
    );
  });
});
