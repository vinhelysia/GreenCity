-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL DEFAULT 50000,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "momoOrderId" TEXT NOT NULL,
    "momoRequestId" TEXT NOT NULL,
    "momoTransactionId" TEXT,
    "momoResultCode" INTEGER,
    "paidAt" TIMESTAMP(3),
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_momoOrderId_key" ON "SubscriptionPayment"("momoOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_momoRequestId_key" ON "SubscriptionPayment"("momoRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_momoTransactionId_key" ON "SubscriptionPayment"("momoTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_subscriptionId_key" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_status_idx" ON "SubscriptionPayment"("userId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_momoOrderId_idx" ON "SubscriptionPayment"("momoOrderId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
