-- Two ACTIVE bookings of the same car may not overlap — enforced by Postgres.
--
-- VehiclesService.book checks for an overlap and then inserts, and two members
-- clicking the same slot at the same moment both passed the check before
-- either row existed. The service check stays (it gives the friendly message
-- in the common case); this is what makes the race impossible rather than
-- unlikely. The service maps the violation (SQLSTATE 23P01) to the same 400.
--
-- Half-open '[)' so a booking ending at 19:00 and the next starting at 19:00
-- do not collide. tsrange, not tstzrange: the columns are TIMESTAMP(3) without
-- time zone, and casting them to timestamptz is not IMMUTABLE, which an index
-- expression must be.
--
-- Only ACTIVE rows take part, so cancelled bookings stay as history without
-- blocking anyone.
--
-- This fails to apply if overlapping ACTIVE bookings already exist. Check first
-- and cancel one side of any pair this returns:
--
--   SELECT a."id", b."id", a."vehicleId", a."startDate", a."endDate", b."startDate", b."endDate"
--   FROM "VehicleBooking" a
--   JOIN "VehicleBooking" b
--     ON a."vehicleId" = b."vehicleId" AND a."id" < b."id"
--    AND a."status" = 'ACTIVE' AND b."status" = 'ACTIVE'
--    AND tsrange(a."startDate", a."endDate", '[)') && tsrange(b."startDate", b."endDate", '[)');

-- btree_gist supplies the `=` operator class for a text column inside GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "VehicleBooking"
  ADD CONSTRAINT "VehicleBooking_no_overlap"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("startDate", "endDate", '[)') WITH &&
  )
  WHERE ("status" = 'ACTIVE');
