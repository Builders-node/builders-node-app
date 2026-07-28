-- CreateIndex
CREATE INDEX "CommunityPlanPurchase_userId_idx" ON "CommunityPlanPurchase"("userId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Apartment_unitTypeId_idx" ON "Apartment"("unitTypeId");

-- CreateIndex
CREATE INDEX "AssignedApartment_apartmentId_idx" ON "AssignedApartment"("apartmentId");

-- CreateIndex
CREATE INDEX "MealMenuItem_userId_idx" ON "MealMenuItem"("userId");

-- CreateIndex
CREATE INDEX "CleaningSchedule_userId_idx" ON "CleaningSchedule"("userId");

-- CreateIndex
CREATE INDEX "RentalRequest_userId_idx" ON "RentalRequest"("userId");

-- CreateIndex
CREATE INDEX "RentalRequest_apartmentId_idx" ON "RentalRequest"("apartmentId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

