-- Finishes the RewardOffer table started in 20260802000001:
--   1. the slug becomes the identity (the cuid was a second key to keep in
--      sync, and a random id cannot be a stable ORDER BY tiebreak);
--   2. the merchant name becomes localized, like offerVi/offerEn already were
--      — "Nước sạch đô thị" was being shown to English readers;
--   3. sortOrder gains the CHECK that pointsCost already has;
--   4. the catalog rows move out of prisma/seed.ts and into the migration.
--
-- (4) is the operational point: a deploy runs `prisma migrate deploy` and
-- nothing else, so a seed-only catalog leaves production with an empty table
-- and a rewards page that renders its empty state.
--
-- Still demo-only. No redemption flow, no inventory, no partner integration
-- behind any row, and no affiliation with the merchants named here.

-- Localize the merchant name. Existing rows carry a brand proper noun that
-- reads the same in both locales, so seeding En from Vi is correct for every
-- row the catalog replacement below does not overwrite anyway.
ALTER TABLE "RewardOffer" RENAME COLUMN "merchantName" TO "merchantNameVi";
ALTER TABLE "RewardOffer" ADD COLUMN "merchantNameEn" TEXT;
UPDATE "RewardOffer" SET "merchantNameEn" = "merchantNameVi";
ALTER TABLE "RewardOffer" ALTER COLUMN "merchantNameEn" SET NOT NULL;

-- Promote slug to primary key. Nothing references RewardOffer, so there is no
-- foreign key to re-point.
ALTER TABLE "RewardOffer" DROP CONSTRAINT "RewardOffer_pkey";
DROP INDEX "RewardOffer_slug_key";
ALTER TABLE "RewardOffer" DROP COLUMN "id";
ALTER TABLE "RewardOffer" ADD CONSTRAINT "RewardOffer_pkey" PRIMARY KEY ("slug");

-- Nothing reads these: the wire contract exposes neither, and an offer has no
-- lifecycle to date-stamp.
ALTER TABLE "RewardOffer" DROP COLUMN "createdAt";
ALTER TABLE "RewardOffer" DROP COLUMN "updatedAt";

-- Companion to RewardOffer_pointsCost_positive from 20260802000001. A negative
-- sortOrder is not corrupt data, but it silently jumps a row to the head of
-- the catalog, which is a content bug nobody looks for in a database.
ALTER TABLE "RewardOffer"
  ADD CONSTRAINT "RewardOffer_sortOrder_nonnegative"
  CHECK ("sortOrder" >= 0);

-- The slugs from the seed-era catalog. Dropped by exact slug rather than
-- TRUNCATE so a row added by hand outside this list survives.
DELETE FROM "RewardOffer"
WHERE "slug" IN (
  'starbucks-beverage-50k',
  'highlands-beverage-50k',
  'jollibee-meal-79k',
  'kfc-meal-99k',
  'evn-electricity-100k',
  'municipal-water-100k'
);

-- sortOrder is spaced by 10 so a row can be inserted between two others later
-- without renumbering the rest. ON CONFLICT makes this block re-runnable by
-- hand against a database that already has it.
INSERT INTO "RewardOffer" (
  "slug",
  "merchantNameVi",
  "merchantNameEn",
  "offerVi",
  "offerEn",
  "pointsCost",
  "demoOnly",
  "isActive",
  "sortOrder"
) VALUES
  ('starbucks-50000', 'Starbucks', 'Starbucks',
   'Voucher đồ uống trị giá 50.000 ₫.',
   'A beverage voucher worth VND 50,000.',
   500, true, true, 10),
  ('highlands-50000', 'Highlands Coffee', 'Highlands Coffee',
   'Voucher đồ uống trị giá 50.000 ₫.',
   'A beverage voucher worth VND 50,000.',
   500, true, true, 20),
  ('jollibee-79000', 'Jollibee', 'Jollibee',
   'Voucher combo món ăn trị giá 79.000 ₫.',
   'A meal combo voucher worth VND 79,000.',
   750, true, true, 30),
  ('kfc-99000', 'KFC', 'KFC',
   'Voucher combo món ăn trị giá 99.000 ₫.',
   'A meal combo voucher worth VND 99,000.',
   900, true, true, 40),
  ('evn-100000', 'EVN', 'EVN',
   'Hỗ trợ 100.000 ₫ cho hóa đơn điện.',
   'VND 100,000 in electricity bill support.',
   1000, true, true, 50),
  ('municipal-water-100000', 'Nước sạch đô thị', 'Municipal water',
   'Hỗ trợ 100.000 ₫ cho hóa đơn nước.',
   'VND 100,000 in water bill support.',
   1000, true, true, 60)
ON CONFLICT ("slug") DO UPDATE SET
  "merchantNameVi" = EXCLUDED."merchantNameVi",
  "merchantNameEn" = EXCLUDED."merchantNameEn",
  "offerVi" = EXCLUDED."offerVi",
  "offerEn" = EXCLUDED."offerEn",
  "pointsCost" = EXCLUDED."pointsCost",
  "demoOnly" = EXCLUDED."demoOnly",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder";
