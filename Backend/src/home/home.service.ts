import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  GLOBAL_CLEANING_PLAN_KEY,
  GLOBAL_MEAL_PLAN_KEY,
  parseGlobalCleaningPlan,
  parseGlobalMealPlan,
} from '../admin/global-settings';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(userId: string) {
    const [globalMealRow, globalCleaningRow] = await Promise.all([
      this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_MEAL_PLAN_KEY } }),
      this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_CLEANING_PLAN_KEY } }),
    ]);
    const globalMealPlan = parseGlobalMealPlan(globalMealRow?.value);
    const globalCleaningPlan = parseGlobalCleaningPlan(globalCleaningRow?.value);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        membership: true,
        residencyApplication: true,
        assignedApartment: { include: { apartment: true } },
        mealMenuItems: { orderBy: { createdAt: 'asc' } },
        cleaningSchedules: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!user) {
      throw new NotFoundException('User home not found.');
    }

    // "Has applied" = a membership application exists for this account's email.
    // A freshly self-registered user has an account but no application yet.
    const application = await this.prisma.application.findUnique({
      where: { email: user.email },
      select: { id: true, status: true },
    });

    const cleaning = user.cleaningSchedules[0] ?? null;

    return {
      account: {
        fullName: user.profile?.fullName,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        // ProsperaSub user_id — used on the client to build the Beach Club
        // QR pass URL (https://prosperasub.com/beach-club?pass=<id>).
        // Null until the first successful ProsperaSub mirror.
        externalMemberId: user.externalMemberId ?? null,
      },
      membership: {
        status: user.membership?.status ?? 'APPLICANT',
        hasApplied: Boolean(application),
        applicationStatus: application?.status ?? null,
      },
      eResidency: {
        status: user.residencyApplication?.status ?? 'NOT_STARTED',
        stage: user.residencyApplication?.stage ?? 'Not started',
        actionLabel: user.residencyApplication?.continueUrl ? 'Continue on Prospera.co' : 'Apply on Prospera.co',
        actionUrl: user.residencyApplication?.continueUrl ?? 'https://portal.eprospera.com/',
      },
      apartment: user.assignedApartment
        ? {
            name: user.assignedApartment.apartment.name,
            status: 'Assigned',
            moveInDate: user.assignedApartment.moveInDate,
            details: user.assignedApartment.apartment.description,
          }
        : null,
      meals: {
        source: 'ProsperaSub.com',
        // The member's own provisioned meal plan (granted on approval — the food
        // they paid for) takes precedence. Members without a personal grant fall
        // back to the current global meal plan so it applies to everyone.
        plan: globalMealPlan,
        items: user.mealMenuItems.length
          ? user.mealMenuItems.map((item) => ({
              id: item.id,
              day: item.day,
              meal: item.meal,
            }))
          : globalMealPlan
            ? [{ id: globalMealPlan.id, day: 'Plan', meal: globalMealPlan.name }]
            : [],
      },
      cleaning: cleaning
        ? {
            source: cleaning.source,
            nextCleaning: cleaning.nextCleaning,
            frequency: cleaning.frequency,
            notes: cleaning.notes,
          }
        : globalCleaningPlan
          ? {
              source: 'ProsperaSub.com',
              nextCleaning: null,
              frequency: globalCleaningPlan.serviceFrequency,
              notes: globalCleaningPlan.name,
            }
          : null,
    };
  }

  /**
   * Public member pass — a compact, printable / QR-scannable summary of
   * everything a member has access to. Looked up by ProsperaSub external
   * member id (already unguessable). Returns 404 if unknown.
   *
   * Deliberately excludes sensitive fields (email, phone, personal notes)
   * — only what a venue / staff member would need to verify access.
   */
  async getPass(externalMemberId: string) {
    const user = await this.prisma.user.findUnique({
      where: { externalMemberId },
      include: {
        profile: { select: { fullName: true } },
        membership: true,
        residencyApplication: { select: { status: true } },
        assignedApartment: { include: { apartment: { select: { name: true } } } },
        mealMenuItems: { orderBy: { createdAt: 'asc' } },
        cleaningSchedules: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException('Pass not found.');

    const apartment = user.assignedApartment?.apartment?.name ?? null;
    const unitMatch = apartment?.match(/\d+/g);
    const unitNumber = unitMatch ? unitMatch[unitMatch.length - 1] : null;

    const mealsFirst = user.mealMenuItems[0]?.meal ?? null;
    const cleaning = user.cleaningSchedules[0] ?? null;

    return {
      memberId: externalMemberId,
      fullName: user.profile?.fullName ?? user.email.split('@')[0],
      membershipStatus: user.membership?.status ?? 'APPLICANT',
      apartment: apartment
        ? { name: apartment, unitNumber }
        : null,
      meals: mealsFirst,
      cleaning: cleaning
        ? { frequency: cleaning.frequency, nextCleaning: cleaning.nextCleaning }
        : null,
      residencyStatus: user.residencyApplication?.status ?? 'NOT_STARTED',
      beachClub: user.residencyApplication?.status === 'VERIFIED' ? 'active' : 'locked',
      issuedAt: new Date().toISOString(),
    };
  }
}
