-- Where a self-serve signup came from. Null for every other way in.
ALTER TABLE "User" ADD COLUMN     "signupSource" TEXT;

-- The affiliate programme no longer takes applications — registering is the
-- way in, and an affiliate is a user who arrived through the affiliate page.
-- IF EXISTS because the migration that created this table may never have been
-- applied: it shipped and was replaced within the same day.
DROP TABLE IF EXISTS "AffiliateApplication";
