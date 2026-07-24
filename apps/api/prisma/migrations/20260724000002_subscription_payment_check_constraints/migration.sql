-- DropIndex
DROP INDEX IF EXISTS "SubscriptionPayment_momoOrderId_idx";

-- AddCheckConstraints
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_amountVnd_check" CHECK ("amountVnd" > 0);
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_durationDays_check" CHECK ("durationDays" > 0);
