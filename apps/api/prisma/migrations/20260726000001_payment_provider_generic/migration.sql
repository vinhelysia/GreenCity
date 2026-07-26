-- Generic provider columns, replacing the MoMo-specific ones.
--
-- Non-destructive by construction: every statement is a RENAME, an ADD, or a
-- type widening. No row is deleted, no column is dropped, and the two CHECK
-- constraints added in 20260724000002 reference "amountVnd" and "durationDays",
-- neither of which is renamed here, so both survive untouched. Do not drop and
-- re-add them — that is the only way to lose them.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THIS MIGRATION IS NOT ZERO-DOWNTIME. It is not rollout-safe, and it is not
-- backward compatible. A rename breaks both directions:
--   * migrate first  -> the running API queries momoOrderId, which is gone
--   * deploy first   -> the new API queries providerOrderId, which does not
--                       exist yet
--   * roll the app back after migrating -> broken again, for the same reason
--
-- render.yaml states that this service does not migrate on deploy: migrations
-- are applied by hand. So the outage window is not a sub-second instance
-- overlap, it is the several minutes between running this and Render finishing
-- a cold build. That window is longer than a deploy overlap — and, unlike one,
-- entirely under your control.
--
-- Deployment sequence (take a short maintenance window):
--   1. Confirm nothing is mid-checkout:
--        SELECT count(*) FROM "SubscriptionPayment"
--        WHERE status = 'PENDING' AND "createdAt" > now() - interval '1 hour';
--      Any MoMo callback still in flight is unprocessable after cutover
--      regardless — the new code carries no MoMo HMAC verifier.
--   2. Suspend the Render service, or accept a few minutes of 502s.
--   3. Apply this migration from your machine (prisma migrate deploy).
--   4. Push the payOS code and let the Render build finish.
--   5. Resume, then register the webhook with payOS:
--        <PUBLIC_API_URL>/payment-webhooks/payos
--
-- ROLLBACK LIMITATION: there is no down migration. Reverting the application
-- alone will not work — the columns it expects no longer exist. Rolling back
-- means writing and applying the inverse renames first, then deploying the old
-- code. Take a database backup before step 3.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "SubscriptionPaymentProvider" AS ENUM ('MOMO', 'PAYOS');

-- Every row that exists today was created against MoMo. DEFAULT 'MOMO' labels
-- them all in this one statement; PostgreSQL 11+ does that without rewriting
-- the table.
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "provider" "SubscriptionPaymentProvider" NOT NULL DEFAULT 'MOMO';

-- New rows are payOS. Flipped after the backfill above, so the two never
-- disagree for even one statement.
ALTER TABLE "SubscriptionPayment"
  ALTER COLUMN "provider" SET DEFAULT 'PAYOS';

-- RenameColumn: data and index membership are preserved; zero rows move.
ALTER TABLE "SubscriptionPayment" RENAME COLUMN "momoOrderId"       TO "providerOrderId";
ALTER TABLE "SubscriptionPayment" RENAME COLUMN "momoRequestId"     TO "providerPaymentId";
ALTER TABLE "SubscriptionPayment" RENAME COLUMN "momoTransactionId" TO "providerTransactionId";
ALTER TABLE "SubscriptionPayment" RENAME COLUMN "momoResultCode"    TO "providerResultCode";

-- RENAME COLUMN does not rename the indexes built on it. These are indexes
-- (created with CREATE UNIQUE INDEX, not ADD CONSTRAINT ... UNIQUE), so the
-- verb is ALTER INDEX; ALTER TABLE ... RENAME CONSTRAINT would error with
-- "constraint does not exist". Prisma derives the expected name as
-- "<Table>_<column>_key", so leaving the old names makes the next
-- `prisma migrate dev` emit a spurious DROP + CREATE for each.
ALTER INDEX "SubscriptionPayment_momoOrderId_key"       RENAME TO "SubscriptionPayment_providerOrderId_key";
ALTER INDEX "SubscriptionPayment_momoRequestId_key"     RENAME TO "SubscriptionPayment_providerPaymentId_key";
ALTER INDEX "SubscriptionPayment_momoTransactionId_key" RENAME TO "SubscriptionPayment_providerTransactionId_key";

-- payOS has no analogue of MoMo's requestId at creation time: paymentLinkId is
-- only known once the provider answers, and a create call that times out never
-- learns it. The unique index survives — PostgreSQL treats NULLs as distinct,
-- so any number of rows may leave this empty.
ALTER TABLE "SubscriptionPayment"
  ALTER COLUMN "providerPaymentId" DROP NOT NULL;

-- int -> text is explicit-only in PostgreSQL, so a bare ALTER ... TYPE TEXT
-- fails with "cannot be cast automatically". USING makes it explicit: NULL
-- casts to NULL, 1006 casts to '1006'. payOS result codes are strings ("00"),
-- and a leading zero cannot survive in an integer column.
ALTER TABLE "SubscriptionPayment"
  ALTER COLUMN "providerResultCode" TYPE TEXT USING "providerResultCode"::TEXT;

-- AddColumn: payOS echoes the payment description on the webhook, and it is
-- compared against the stored value before access is granted.
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "providerDescription" TEXT;
