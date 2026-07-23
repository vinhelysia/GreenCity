-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('LISTING_COMPLETED', 'CLEANUP_VERIFIED');

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "PointReason" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One award per granting event: this is what makes an award idempotent even if
-- the service layer is called twice.
CREATE UNIQUE INDEX "PointEntry_reason_referenceId_key" ON "PointEntry"("reason", "referenceId");
CREATE INDEX "PointEntry_userId_createdAt_idx" ON "PointEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
