import snapshot from "./recycling-points.json";

/**
 * A committed snapshot of OpenStreetMap `amenity=recycling` points inside the
 * Ho Chi Minh City bounding box. Refresh with:
 *
 *   node scripts/refresh-recycling-points.mjs
 *
 * Data © OpenStreetMap contributors, ODbL 1.0. The page renders the attribution
 * and `fetchedAt`; neither is optional.
 */
export type RecyclingPoint = {
  /** OSM element, e.g. "node/12728534042" — links back to the source record. */
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  operator: string | null;
  /**
   * OSM's `recycling_type`. "container" is a real bin. `null` means somebody
   * marked the spot as recycling without saying what it is, and the UI must
   * keep that distinction rather than calling all of them bins.
   */
  recyclingType: string | null;
  /** OSM `recycling:*=yes` keys, e.g. ["cans", "pet_drink_bottles"]. */
  materials: string[];
};

export type RecyclingSnapshot = {
  source: string;
  sourceUrl: string;
  license: string;
  area: string;
  bbox: number[];
  fetchedAt: string;
  points: RecyclingPoint[];
};

export const RECYCLING_SNAPSHOT = snapshot as RecyclingSnapshot;

export const RECYCLING_POINTS = RECYCLING_SNAPSHOT.points;

/** Points OSM actually tags as containers — the ones that are really bins. */
export const RECYCLING_CONTAINERS = RECYCLING_POINTS.filter(
  (p) => p.recyclingType === "container",
);

export function osmUrl(id: string): string {
  return `https://www.openstreetmap.org/${id}`;
}
