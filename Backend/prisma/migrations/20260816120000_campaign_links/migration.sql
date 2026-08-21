-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "campaignCode" TEXT;

-- CreateTable
CREATE TABLE "CampaignLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignVisit" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLink_code_key" ON "CampaignLink"("code");

-- CreateIndex
CREATE INDEX "CampaignLink_active_idx" ON "CampaignLink"("active");

-- CreateIndex
CREATE INDEX "CampaignVisit_linkId_createdAt_idx" ON "CampaignVisit"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignVisit_linkId_visitorKey_idx" ON "CampaignVisit"("linkId", "visitorKey");

-- AddForeignKey
ALTER TABLE "CampaignVisit" ADD CONSTRAINT "CampaignVisit_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "CampaignLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

