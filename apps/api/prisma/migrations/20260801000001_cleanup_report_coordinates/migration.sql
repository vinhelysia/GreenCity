-- Exact coordinates of a reported dumping site.
--
-- Nullable on purpose: every report predating this migration has none, and the
-- form still accepts a typed address when the reporter denies location access.
-- Plain Float pairs rather than a PostGIS geography column, matching the
-- existing LocationExact model — nothing here does radius or bbox queries in
-- SQL yet, and adding a geography type would need Prisma's Unsupported().
--
-- These are the EXACT coordinates and are served only to the reporter and to
-- admins. The public verified-reports feed exposes city/district only.
ALTER TABLE "CleanupReport" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "CleanupReport" ADD COLUMN "longitude" DOUBLE PRECISION;

-- Reject impossible coordinates at the database, not only in Zod: a bad pair
-- here would put a cleanup crew anywhere on earth. Both-or-neither keeps a
-- half-set pair from ever existing.
ALTER TABLE "CleanupReport" ADD CONSTRAINT "CleanupReport_coordinates_valid"
  CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR (
      "latitude" IS NOT NULL AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90
      AND "longitude" BETWEEN -180 AND 180
    )
  );
