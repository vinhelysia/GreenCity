-- Both columns are nullable so existing payment history remains valid.
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "providerCheckoutUrl" TEXT;

-- PostgreSQL permits multiple NULLs, while every API-created UUID is unique.
CREATE UNIQUE INDEX "SubscriptionPayment_idempotencyKey_key"
  ON "SubscriptionPayment"("idempotencyKey");
