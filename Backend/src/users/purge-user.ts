import type { PrismaService } from '../database/prisma.service';

/**
 * Rows keyed by email rather than by user id: what a person sent us before
 * they had an account, or without one. Matched case-insensitively because the
 * address was typed by hand each time — "Ana@x.com" applying and "ana@x.com"
 * signing up are the same person, and erasure has to find both.
 */
export function personalRecordsByEmail(email: string) {
  return { email: { equals: email, mode: 'insensitive' as const } };
}

/**
 * Remove a user and every row owned by it. MUST run inside a caller-provided
 * transaction. Shared by admin deletion and member self-deletion (GDPR erasure)
 * so both stay in sync.
 *
 * Two kinds of row are detached rather than deleted, because they are records
 * of what happened rather than data about the person:
 *  - AuditEvent: who-did-what history (userId → null).
 *  - Payment: money that changed hands. The books have to keep adding up after
 *    a member leaves, so the amounts, dates and statuses stay, with the link to
 *    the person cut (userId → null; the FK is ON DELETE SET NULL as a backstop).
 *
 * Erasure also reaches the rows that only know the person by email: their
 * Application, any half-confirmed ApplicationVerification (which still holds
 * the whole form as JSON), and a GuideRequest lead. Without this, "delete my
 * account" left their application — phone number, about-me, links — behind.
 */
export async function purgeUser(tx: PrismaService, userId: string): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
  const where = { userId };
  await tx.auditEvent.updateMany({ where, data: { userId: null } });
  await tx.payment.updateMany({ where, data: { userId: null } });
  await tx.notification.deleteMany({ where });
  await tx.maintenanceRequest.deleteMany({ where });
  await tx.vehicleBooking.deleteMany({ where });
  await tx.eventRsvp.deleteMany({ where });
  await tx.mealMenuItem.deleteMany({ where });
  await tx.cleaningSchedule.deleteMany({ where });
  await tx.supportTicket.deleteMany({ where });
  await tx.communityPlanPurchase.deleteMany({ where });
  await tx.assignedApartment.deleteMany({ where });
  await tx.subscriptionPlan.deleteMany({ where });
  await tx.residencyApplication.deleteMany({ where });
  await tx.emailVerificationToken.deleteMany({ where });
  await tx.passwordResetToken.deleteMany({ where });
  await tx.membership.deleteMany({ where });
  await tx.profile.deleteMany({ where });
  if (user?.email) {
    const byEmail = personalRecordsByEmail(user.email);
    await tx.application.deleteMany({ where: byEmail });
    await tx.applicationVerification.deleteMany({ where: byEmail });
    await tx.guideRequest.deleteMany({ where: byEmail });
  }
  await tx.user.delete({ where: { id: userId } });
}
