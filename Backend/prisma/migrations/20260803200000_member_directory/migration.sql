-- Community directory fields on Profile.
--
-- directoryOptIn defaults to false so existing members are NOT listed until
-- they choose to be — the directory is opt-in, not opt-out. The rest are
-- nullable free-text / JSON columns, so no backfill is needed.

ALTER TABLE "Profile" ADD COLUMN "directoryOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "headline"       TEXT;
ALTER TABLE "Profile" ADD COLUMN "bio"            TEXT;
ALTER TABLE "Profile" ADD COLUMN "skillsJson"     TEXT;
ALTER TABLE "Profile" ADD COLUMN "linksJson"      TEXT;

CREATE INDEX "Profile_directoryOptIn_idx" ON "Profile" ("directoryOptIn");
