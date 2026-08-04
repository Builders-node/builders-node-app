-- Community events + RSVPs.
--
-- Events default to unpublished so an admin can draft one before members see
-- it. RSVP is unique per (event, member): answering again updates the row
-- rather than stacking duplicates.

CREATE TABLE "Event" (
  "id"          TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "location"    TEXT,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3),
  "capacity"    INTEGER,
  "published"   BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_startsAt_idx"  ON "Event" ("startsAt");
CREATE INDEX "Event_published_idx" ON "Event" ("published");

CREATE TABLE "EventRsvp" (
  "id"        TEXT         NOT NULL,
  "eventId"   TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "status"    TEXT         NOT NULL DEFAULT 'GOING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp" ("eventId", "userId");
CREATE INDEX "EventRsvp_userId_idx" ON "EventRsvp" ("userId");

ALTER TABLE "EventRsvp"
  ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId")
  REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventRsvp"
  ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
