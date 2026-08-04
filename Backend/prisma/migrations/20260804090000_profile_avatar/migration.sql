-- Inline avatar storage, matching the Vehicle/MaintenanceRequest photo pattern.
-- avatarUrl stays for backwards compatibility; the API now returns a computed
-- /users/:id/avatar path whenever avatarData is present.

ALTER TABLE "Profile" ADD COLUMN "avatarData"     TEXT;
ALTER TABLE "Profile" ADD COLUMN "avatarFileType" TEXT;
