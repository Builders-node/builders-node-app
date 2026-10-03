-- Payments outlive the member they were billed to.
--
-- Erasing a member used to hard-delete their invoices, so every past month's
-- income quietly shrank whenever somebody left. The amounts are a record of
-- money that changed hands, not personal data in themselves: keep the row,
-- cut the link. purgeUser nulls userId explicitly; ON DELETE SET NULL is the
-- backstop for any other path that deletes a User.
--
-- @@unique([userId, billingPeriod]) is unaffected in practice: Postgres treats
-- NULLs as distinct, so detached invoices never collide with each other.

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
