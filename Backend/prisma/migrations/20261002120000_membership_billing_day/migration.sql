-- The day of the month a member is billed on, kept separately from dueDate.
--
-- Rolling dueDate forward from itself drifted: Jan 31 → Feb 28 → Mar 28 → the
-- 28th forever, because a clamped date can't remember it started on the 31st.
-- The billing run now steps from this anchor instead.

ALTER TABLE "Membership" ADD COLUMN "billingDay" INTEGER;

-- Backfill from the current due date. A member who has already drifted (a 31st
-- now sitting on the 28th) is anchored on the 28th — the original day isn't
-- recorded anywhere to recover; an admin can move their dueDate back to the
-- 31st once and the anchor follows.
UPDATE "Membership"
SET "billingDay" = EXTRACT(DAY FROM "dueDate")::INTEGER
WHERE "dueDate" IS NOT NULL AND "billingDay" IS NULL;
