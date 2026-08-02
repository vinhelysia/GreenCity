-- Demo-only illustrative reward catalog: merchant names and offers a user
-- could one day redeem points for. There is no redemption flow, no
-- inventory, no real partner integration behind any row, and no affiliation
-- with the merchants named here — see RewardOfferSchema in packages/shared
-- for the wire contract this table feeds.

-- CreateTable
CREATE TABLE "RewardOffer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "offerVi" TEXT NOT NULL,
    "offerEn" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "demoOnly" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardOffer_slug_key" ON "RewardOffer"("slug");

-- CreateIndex
-- The catalog endpoint always filters on isActive and orders by sortOrder —
-- this index covers that query directly instead of a full-table scan + sort.
CREATE INDEX "RewardOffer_isActive_sortOrder_idx" ON "RewardOffer"("isActive", "sortOrder");

-- CreateCheckConstraint: Prisma cannot express CHECK constraints, hand-added here.
-- A zero or negative cost would make an offer free to "redeem" the moment
-- redemption ever ships; reject it at the boundary now rather than trust
-- every future writer of this table to remember.
ALTER TABLE "RewardOffer"
  ADD CONSTRAINT "RewardOffer_pointsCost_positive"
  CHECK ("pointsCost" > 0);
