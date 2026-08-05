-- AlterTable
ALTER TABLE "CleaningSchedule" ADD COLUMN     "bookedAt" TIMESTAMP(3),
ADD COLUMN     "timeSlot" TEXT,
ADD COLUMN     "weekday" INTEGER;
