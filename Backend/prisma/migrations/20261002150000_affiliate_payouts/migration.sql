-- Affiliate ledger: the reward fixed per referral when it joins, and the
-- payouts made against it.
ALTER TABLE "Application" ADD COLUMN "referralRewardCents" INTEGER;

CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AffiliatePayout_userId_idx" ON "AffiliatePayout"("userId");
