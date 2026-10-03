-- Indexes for the queries that run on every admin page load and every billing
-- run. Plain CREATE INDEX (not CONCURRENTLY): Prisma runs a migration file as
-- one script, which CONCURRENTLY refuses, and these tables are small enough
-- that the brief write lock is not noticeable.

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_referredByUserId_idx" ON "Application"("referredByUserId");

-- CreateIndex
CREATE INDEX "Application_campaignCode_idx" ON "Application"("campaignCode");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Payment_status_dueDate_idx" ON "Payment"("status", "dueDate");
