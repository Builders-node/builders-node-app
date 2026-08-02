-- Admin needs to act on support tickets + payments from a queue.
-- New nullable columns so existing rows aren't affected.

ALTER TABLE "SupportTicket" ADD COLUMN "adminNote"  TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket" ("status");

ALTER TABLE "Payment"       ADD COLUMN "adminNote"  TEXT;
CREATE INDEX "Payment_status_idx" ON "Payment" ("status");
