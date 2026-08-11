-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "monthlyAmountCents" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "billingPeriod" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_userId_billingPeriod_key" ON "Payment"("userId", "billingPeriod");

