-- Opaque bearer token behind each member's QR pass. Nullable — minted lazily
-- the first time a member opens their pass, so existing rows need no backfill.
-- Unique so a token maps to exactly one member; rotating issues a fresh value.

ALTER TABLE "User" ADD COLUMN "passToken" TEXT;
CREATE UNIQUE INDEX "User_passToken_key" ON "User" ("passToken");
