-- CreateTable
CREATE TABLE "AffiliateApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telegram" TEXT,
    "country" TEXT,
    "audience" TEXT,
    "audienceSize" TEXT,
    "linksJson" TEXT,
    "about" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "userId" TEXT,
    "campaignCode" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateApplication_email_key" ON "AffiliateApplication"("email");

-- CreateIndex
CREATE INDEX "AffiliateApplication_status_createdAt_idx" ON "AffiliateApplication"("status", "createdAt");
