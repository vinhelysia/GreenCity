import type { LocationExact, LocationPublic } from '@prisma/client';
import type { LocationExactDto, LocationPublicDto } from '@greencity/shared';

/** Approximate coords to ~1.1km grid (~0.01 deg) and strip street-level fields. */
export function toPublicFromExact(exact: LocationExact): Omit<
  LocationPublicDto,
  'id'
> & { approxLatitude: number; approxLongitude: number } {
  const approxLatitude = Math.round(exact.latitude * 100) / 100;
  const approxLongitude = Math.round(exact.longitude * 100) / 100;
  const gridCell = `${approxLatitude.toFixed(2)}:${approxLongitude.toFixed(2)}`;
  return {
    approxLatitude,
    approxLongitude,
    city: exact.city,
    district: exact.district,
    ward: exact.ward,
    gridCell,
  };
}

export function toExactDto(exact: LocationExact): LocationExactDto {
  return {
    id: exact.id,
    ownerId: exact.ownerId,
    label: exact.label,
    addressLine: exact.addressLine,
    ward: exact.ward,
    district: exact.district,
    city: exact.city,
    country: exact.country,
    latitude: exact.latitude,
    longitude: exact.longitude,
    createdAt: exact.createdAt.toISOString(),
    updatedAt: exact.updatedAt.toISOString(),
  };
}

export function toPublicDto(pub: LocationPublic): LocationPublicDto {
  return {
    id: pub.id,
    approxLatitude: pub.approxLatitude,
    approxLongitude: pub.approxLongitude,
    city: pub.city,
    district: pub.district,
    ward: pub.ward,
    gridCell: pub.gridCell,
  };
}

/** Keys that must never appear in public JSON. */
export const PRIVATE_LOCATION_KEYS = [
  'latitude',
  'longitude',
  'addressLine',
  'ownerId',
  'exactId',
] as const;

export function assertNoPrivateLocationKeys(payload: unknown): void {
  const json = JSON.stringify(payload);
  for (const key of PRIVATE_LOCATION_KEYS) {
    // Match JSON object keys only: "latitude":
    if (json.includes(`"${key}"`)) {
      throw new Error(`Private location key leaked in public payload: ${key}`);
    }
  }
}
