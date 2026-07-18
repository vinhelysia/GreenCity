-- Phase 1: enums, harden User/Session, AuditLog, MediaAsset, LocationExact/Public

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'CLEANUP_PARTNER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');

-- Convert roles via add/drop (PostgreSQL forbids subqueries in USING)
ALTER TABLE "User" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "User" ADD COLUMN "roles_new" "UserRole"[] NOT NULL DEFAULT ARRAY['USER']::"UserRole"[];

UPDATE "User" SET "roles_new" = ARRAY['USER']::"UserRole"[]
WHERE "roles" IS NULL OR cardinality("roles") = 0;

UPDATE "User" SET "roles_new" = ARRAY['ADMIN']::"UserRole"[]
WHERE EXISTS (
  SELECT 1 FROM unnest("roles") AS r
  WHERE lower(r) IN ('admin', 'ADMIN')
);

UPDATE "User" SET "roles_new" = ARRAY['CLEANUP_PARTNER']::"UserRole"[]
WHERE EXISTS (
  SELECT 1 FROM unnest("roles") AS r
  WHERE lower(r) IN ('cleanup_partner', 'cleanup-partner', 'CLEANUP_PARTNER')
)
AND NOT EXISTS (
  SELECT 1 FROM unnest("roles") AS r
  WHERE lower(r) IN ('admin', 'ADMIN')
);

ALTER TABLE "User" DROP COLUMN "roles";
ALTER TABLE "User" RENAME COLUMN "roles_new" TO "roles";
ALTER TABLE "User" ALTER COLUMN "roles" SET DEFAULT ARRAY['USER']::"UserRole"[];

-- Convert status via add/drop
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ADD COLUMN "status_new" "UserStatus" NOT NULL DEFAULT 'ACTIVE'::"UserStatus";

UPDATE "User" SET "status_new" = 'DISABLED'::"UserStatus"
WHERE lower("status") IN ('disabled', 'DISABLED');

UPDATE "User" SET "status_new" = 'PENDING'::"UserStatus"
WHERE lower("status") IN ('pending', 'PENDING');

ALTER TABLE "User" DROP COLUMN "status";
ALTER TABLE "User" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"UserStatus";

-- Require email for Phase 1 local-password accounts
UPDATE "User"
SET "email" = 'legacy+' || "id" || '@invalid.local'
WHERE "email" IS NULL OR btrim("email") = '';

UPDATE "User" SET "email" = lower(btrim("email"));

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- Session cascade delete with user
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MediaAsset
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX "MediaAsset_ownerId_idx" ON "MediaAsset"("ownerId");

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LocationExact
CREATE TABLE "LocationExact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT,
    "addressLine" TEXT,
    "ward" TEXT,
    "district" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'VN',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocationExact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocationExact_ownerId_idx" ON "LocationExact"("ownerId");

ALTER TABLE "LocationExact"
  ADD CONSTRAINT "LocationExact_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LocationPublic
CREATE TABLE "LocationPublic" (
    "id" TEXT NOT NULL,
    "exactId" TEXT NOT NULL,
    "approxLatitude" DOUBLE PRECISION NOT NULL,
    "approxLongitude" DOUBLE PRECISION NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "ward" TEXT,
    "gridCell" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocationPublic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocationPublic_exactId_key" ON "LocationPublic"("exactId");

ALTER TABLE "LocationPublic"
  ADD CONSTRAINT "LocationPublic_exactId_fkey"
  FOREIGN KEY ("exactId") REFERENCES "LocationExact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
