-- AlterTable
ALTER TABLE "CleaningSchedule" ADD COLUMN     "bookingSyncError" TEXT,
ADD COLUMN     "bookingSyncedAt" TIMESTAMP(3),
ADD COLUMN     "externalBookingIdsJson" TEXT;

