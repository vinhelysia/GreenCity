-- Marketplace vertical slice: scrap request -> quote -> listing -> reservation,
-- plus the published category price list and the buyer subscription gate.

-- CreateEnum
CREATE TYPE "ScrapRequestStatus" AS ENUM ('SUBMITTED', 'QUOTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ScrapCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPricePerKgVnd" INTEGER NOT NULL,
    "maxPricePerKgVnd" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapRequest" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "estimatedWeightKg" DOUBLE PRECISION NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "note" TEXT,
    "status" "ScrapRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "scrapRequestId" TEXT NOT NULL,
    "pricePerKgVnd" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "scrapRequestId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "estimatedWeightKg" DOUBLE PRECISION NOT NULL,
    "sellerPricePerKgVnd" INTEGER NOT NULL,
    "buyerPricePerKgVnd" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "mediaAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapCategory_name_key" ON "ScrapCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapRequest_mediaAssetId_key" ON "ScrapRequest"("mediaAssetId");

-- CreateIndex
CREATE INDEX "ScrapRequest_sellerId_idx" ON "ScrapRequest"("sellerId");

-- CreateIndex
CREATE INDEX "ScrapRequest_status_idx" ON "ScrapRequest"("status");

-- CreateIndex
CREATE INDEX "Quote_scrapRequestId_status_idx" ON "Quote"("scrapRequestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_quoteId_key" ON "MarketplaceListing"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_scrapRequestId_key" ON "MarketplaceListing"("scrapRequestId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_listingId_key" ON "Reservation"("listingId");

-- CreateIndex
CREATE INDEX "Reservation_buyerId_idx" ON "Reservation"("buyerId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- AddForeignKey
ALTER TABLE "ScrapRequest" ADD CONSTRAINT "ScrapRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapRequest" ADD CONSTRAINT "ScrapRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ScrapCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapRequest" ADD CONSTRAINT "ScrapRequest_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_scrapRequestId_fkey" FOREIGN KEY ("scrapRequestId") REFERENCES "ScrapRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_scrapRequestId_fkey" FOREIGN KEY ("scrapRequestId") REFERENCES "ScrapRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateCheckConstraint: Prisma cannot express CHECK constraints, hand-added here.
ALTER TABLE "ScrapCategory"
  ADD CONSTRAINT "ScrapCategory_price_band_check"
  CHECK ("minPricePerKgVnd" > 0 AND "minPricePerKgVnd" <= "maxPricePerKgVnd");

ALTER TABLE "ScrapRequest"
  ADD CONSTRAINT "ScrapRequest_estimatedWeightKg_check"
  CHECK ("estimatedWeightKg" > 0);

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_pricePerKgVnd_check"
  CHECK ("pricePerKgVnd" > 0);

ALTER TABLE "MarketplaceListing"
  ADD CONSTRAINT "MarketplaceListing_prices_and_weight_check"
  CHECK (
    "sellerPricePerKgVnd" > 0
    AND "buyerPricePerKgVnd" > 0
    AND "estimatedWeightKg" > 0
  );
