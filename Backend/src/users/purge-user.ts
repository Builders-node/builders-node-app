import type { PrismaService } from '../database/prisma.service';

/**
 * Remove a user and every row owned by it. MUST run inside a caller-provided
 * transaction. Shared by admin deletion and member self-deletion (GDPR erasure)
 * so both stay in sync. AuditEvent rows are kept but detached (userId → null).
 */
export async function purgeUser(tx: PrismaService, userId: string): Promise<void> {
  const where = { userId };
  await tx.auditEvent.updateMany({ where, data: { userId: null } });
  await tx.notification.deleteMany({ where });
  await tx.maintenanceRequest.deleteMany({ where });
  await tx.vehicleBooking.deleteMany({ where });
  await tx.mealMenuItem.deleteMany({ where });
  await tx.cleaningSchedule.deleteMany({ where });
  await tx.supportTicket.deleteMany({ where });
  await tx.payment.deleteMany({ where });
  await tx.communityPlanPurchase.deleteMany({ where });
  await tx.assignedApartment.deleteMany({ where });
  await tx.subscriptionPlan.deleteMany({ where });
  await tx.residencyApplication.deleteMany({ where });
  await tx.emailVerificationToken.deleteMany({ where });
  await tx.passwordResetToken.deleteMany({ where });
  await tx.membership.deleteMany({ where });
  await tx.profile.deleteMany({ where });
  await tx.user.delete({ where: { id: userId } });
}
