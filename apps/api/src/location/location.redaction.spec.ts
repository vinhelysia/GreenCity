import {
  assertNoPrivateLocationKeys,
  toPublicFromExact,
} from './location.redaction';

describe('location redaction', () => {
  const exact = {
    id: 'loc1',
    ownerId: 'user1',
    label: 'Home',
    addressLine: '12 Secret Street',
    ward: 'Ward 1',
    district: 'District 3',
    city: 'Ho Chi Minh',
    country: 'VN',
    latitude: 10.7769,
    longitude: 106.7009,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('approximates coordinates and keeps admin areas', () => {
    const pub = toPublicFromExact(exact);
    expect(pub.approxLatitude).toBe(10.78);
    expect(pub.approxLongitude).toBe(106.7);
    expect(pub.city).toBe('Ho Chi Minh');
    expect(pub.district).toBe('District 3');
  });

  it('serialized public payload has no private keys', () => {
    const pub = {
      id: 'pub1',
      ...toPublicFromExact(exact),
    };
    const json = JSON.parse(JSON.stringify(pub)) as unknown;
    expect(() => assertNoPrivateLocationKeys(json)).not.toThrow();
    const text = JSON.stringify(json);
    expect(text).not.toContain('addressLine');
    expect(text).not.toContain('"latitude"');
    expect(text).not.toContain('"longitude"');
    expect(text).not.toContain('Secret Street');
  });
});
