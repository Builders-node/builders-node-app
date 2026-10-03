-- Structured answers from the apply form, the payment amount actually asked
-- for, and the stamps that cap automatic reminders and record rejections.
ALTER TABLE "Application" ADD COLUMN "planId" TEXT;
ALTER TABLE "Application" ADD COLUMN "stayDuration" TEXT;
ALTER TABLE "Application" ADD COLUMN "heardVia" TEXT;
ALTER TABLE "Application" ADD COLUMN "paymentAmountCents" INTEGER;
ALTER TABLE "Application" ADD COLUMN "paymentCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Application" ADD COLUMN "paymentReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "autoMeetingReminders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "rejectionEmailSentAt" TIMESTAMP(3);
