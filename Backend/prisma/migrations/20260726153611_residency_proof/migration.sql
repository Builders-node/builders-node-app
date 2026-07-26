-- Manual E-Residency proof flow: no external API, drop NOT NULL and add proof/review columns.
ALTER TABLE "ResidencyApplication" ALTER COLUMN "externalApplicationId" DROP NOT NULL;
ALTER TABLE "ResidencyApplication" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "ResidencyApplication" ADD COLUMN "proofFileType" TEXT;
ALTER TABLE "ResidencyApplication" ADD COLUMN "proofData" TEXT;
ALTER TABLE "ResidencyApplication" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "ResidencyApplication" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ResidencyApplication" ADD COLUMN "reviewNote" TEXT;
