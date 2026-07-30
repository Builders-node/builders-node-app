-- Mirror members and their assigned plans onto ProsperaSub so the provider
-- can see the subscription on their side. Columns are populated lazily on
-- the first successful call to ProsperaSub — nullable so existing rows are
-- unaffected until they get re-provisioned.

ALTER TABLE "User"             ADD COLUMN "externalMemberId"       TEXT;
ALTER TABLE "MealMenuItem"     ADD COLUMN "externalSubscriptionId" TEXT;
ALTER TABLE "CleaningSchedule" ADD COLUMN "externalSubscriptionId" TEXT;

CREATE UNIQUE INDEX "User_externalMemberId_key"                   ON "User"             ("externalMemberId");
CREATE UNIQUE INDEX "MealMenuItem_externalSubscriptionId_key"     ON "MealMenuItem"     ("externalSubscriptionId");
CREATE UNIQUE INDEX "CleaningSchedule_externalSubscriptionId_key" ON "CleaningSchedule" ("externalSubscriptionId");
