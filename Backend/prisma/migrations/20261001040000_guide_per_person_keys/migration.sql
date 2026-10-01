-- One key per reader, instead of one key for everyone.
-- The table is new and empty in every environment, so a plain NOT NULL column
-- needs no backfill.
ALTER TABLE "GuideRequest" ADD COLUMN     "accessKey" TEXT NOT NULL;
ALTER TABLE "GuideRequest" ADD COLUMN     "openedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "GuideRequest_accessKey_key" ON "GuideRequest"("accessKey");

-- The shared key and the hand-entered guide link are gone: the key is minted
-- per reader now, and the guide is served by the app itself.
DELETE FROM "GlobalSetting" WHERE "key" IN ('guide_access_key', 'guide_url');
