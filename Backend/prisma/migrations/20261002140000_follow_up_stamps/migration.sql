-- Caps on the automatic follow-ups: one "finish your application" email per
-- unconfirmed form, at most two follow-ups per guide reader.
ALTER TABLE "ApplicationVerification" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "GuideRequest" ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuideRequest" ADD COLUMN "lastFollowUpAt" TIMESTAMP(3);
