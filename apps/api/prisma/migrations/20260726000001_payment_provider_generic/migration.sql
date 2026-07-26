-- Generic provider columns, replacing the MoMo-specific ones.
--
-- Non-destructive by construction: every statement is a RENAME, an ADD, or a
-- type widening. No row is deleted, no column is dropped, and the two CHECK
-- constraints added in 20260724000002 reference "amountVnd" and "durationDays",
-- neither of which is renamed here, so both survive untouched. Do not drop and
-- re-add them — that is the only way to lose them.

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
