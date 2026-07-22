-- CreateEnum
CREATE TYPE "CleanupReportStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "CleanupReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "addressLine" TEXT,
    "ward" TEXT,
    "district" TEXT,
    "city" TEXT,
    "mediaAssetId" TEXT NOT NULL,
    "status" "CleanupReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    CONSTRAINT "CleanupReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CleanupReport_mediaAssetId_key" ON "CleanupReport"("mediaAssetId");
CREATE INDEX "CleanupReport_reporterId_idx" ON "CleanupReport"("reporterId");
CREATE INDEX "CleanupReport_status_idx" ON "CleanupReport"("status");

-- AddForeignKey
ALTER TABLE "CleanupReport" ADD CONSTRAINT "CleanupReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CleanupReport" ADD CONSTRAINT "CleanupReport_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
