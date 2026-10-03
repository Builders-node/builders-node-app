-- Revocable sessions: a token is only good for the version it was issued at.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
