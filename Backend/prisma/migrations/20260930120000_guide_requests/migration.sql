-- CreateTable
CREATE TABLE "GuideRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT,
    "campaignCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuideRequest_email_key" ON "GuideRequest"("email");

-- CreateIndex
CREATE INDEX "GuideRequest_createdAt_idx" ON "GuideRequest"("createdAt");
