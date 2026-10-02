BEGIN;

CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Reservation"
  ADD COLUMN "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "pickupLocation" TEXT,
  ADD COLUMN "coordinatorContact" TEXT,
  ADD COLUMN "scheduledById" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "completedById" TEXT,
  ADD COLUMN "actualWeightKg" DOUBLE PRECISION,
  ADD COLUMN "sellerReceivedAmountVnd" INTEGER,
  ADD COLUMN "receiptNote" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancelReason" TEXT;

-- Preserve historical outcomes without inventing actual weights or payments.
UPDATE "Reservation" r SET "status" = CASE
  WHEN l."status" = 'COMPLETED' THEN 'COMPLETED'::"ReservationStatus"
  WHEN l."status" = 'RESERVED' THEN 'RESERVED'::"ReservationStatus"
  ELSE 'CANCELLED'::"ReservationStatus"
END FROM "MarketplaceListing" l WHERE l.id = r."listingId";

DROP INDEX "Reservation_listingId_key";
CREATE INDEX "Reservation_listingId_idx" ON "Reservation"("listingId");
CREATE UNIQUE INDEX "Reservation_one_active_per_listing"
  ON "Reservation"("listingId") WHERE "status" = 'RESERVED';

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_schedule_check" CHECK (
    ("scheduledAt" IS NULL AND "pickupLocation" IS NULL AND "coordinatorContact" IS NULL AND "scheduledById" IS NULL)
    OR ("scheduledAt" IS NOT NULL AND length(btrim("pickupLocation")) BETWEEN 3 AND 240
      AND "pickupLocation" IS NOT NULL AND "coordinatorContact" IS NOT NULL
      AND length(btrim("coordinatorContact")) BETWEEN 3 AND 160 AND "scheduledById" IS NOT NULL)
  ),
  ADD CONSTRAINT "Reservation_settlement_check" CHECK (
    ("completedAt" IS NULL AND "completedById" IS NULL AND "actualWeightKg" IS NULL
      AND "sellerReceivedAmountVnd" IS NULL AND "receiptNote" IS NULL)
    OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completedById" IS NOT NULL
      AND "actualWeightKg" IS NOT NULL AND "actualWeightKg" > 0 AND "actualWeightKg" <= 1000
      AND "sellerReceivedAmountVnd" IS NOT NULL AND "sellerReceivedAmountVnd" > 0
      AND "receiptNote" IS NOT NULL AND length(btrim("receiptNote")) BETWEEN 3 AND 500)
  ),
  ADD CONSTRAINT "Reservation_cancellation_check" CHECK (
    ("cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancelReason" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL
      AND "cancelReason" IS NOT NULL AND length(btrim("cancelReason")) BETWEEN 3 AND 500)
  );

COMMIT;
