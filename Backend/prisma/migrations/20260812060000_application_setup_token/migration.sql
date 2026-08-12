-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "setupToken" TEXT,
ADD COLUMN     "setupTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Application_setupToken_key" ON "Application"("setupToken");

