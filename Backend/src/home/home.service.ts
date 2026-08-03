import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProsperaSubClient } from '../subscriptions/prospera-sub.client';
import {
  GLOBAL_CLEANING_PLAN_KEY,
  GLOBAL_MEAL_PLAN_KEY,
  parseGlobalCleaningPlan,
  parseGlobalMealPlan,
} from '../admin/global-settings';

/** Fallback used when ProsperaSub's package doesn't list slots yet. */
const DEFAULT_CLEANING_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00'];

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prosperaSub: ProsperaSubClient,
  ) {}

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
   * Public member pass, resolved from the opaque QR token. Written for the
   * person doing the checking (front desk, Beach Club, gym), so it answers
   * one question: what is this member allowed to use right now?
   *
   * Always 200 — an unknown or revoked token returns { valid: false } rather
   * than a 404, so scanning can't be used to probe which tokens exist.
   *
   * Deliberately omits email, phone, payment amounts and internal notes.
   * Staff need access state, not the member's file.
   */
  async getPassByToken(token: string) {
    const invalid = (reason: string) => ({
      valid: false as const,
      reason,
      checkedAt: new Date().toISOString(),
    });

    if (!token || token.length < 16) return invalid('This pass link is not valid.');

    const user = await this.prisma.user.findUnique({
      where: { passToken: token },
      include: {
        profile: { select: { fullName: true } },
        membership: true,
        residencyApplication: { select: { status: true } },
        assignedApartment: { include: { apartment: { select: { name: true } } } },
        mealMenuItems: { orderBy: { createdAt: 'asc' } },
        cleaningSchedules: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!user) return invalid('This pass is not recognised.');

    // Membership is the gate. When someone leaves, their pass stops working
    // on the next scan — no manual revocation needed for the common case.
    const membershipStatus = user.membership?.status ?? 'APPLICANT';
    if (membershipStatus !== 'ACTIVE_MEMBER') {
      return {
        ...invalid('This membership is not active.'),
        fullName: user.profile?.fullName ?? user.email.split('@')[0],
        membershipStatus,
      };
    }

    const apartmentName = user.assignedApartment?.apartment?.name ?? null;
    const unitMatch = apartmentName?.match(/\d+/g);
    const unitNumber = unitMatch ? unitMatch[unitMatch.length - 1] : null;

    const mealPlan = user.mealMenuItems[0]?.meal ?? null;
    const cleaning = user.cleaningSchedules[0] ?? null;
    const residencyVerified = user.residencyApplication?.status === 'VERIFIED';

    // One flat list so the scanner UI is a simple checklist. `granted` drives
    // the green tick; `detail` is the small print underneath.
    const access = [
      {
        key: 'residence',
        label: 'Residence',
        granted: Boolean(apartmentName),
        detail: apartmentName ?? 'No unit assigned',
      },
      {
        key: 'meals',
        label: 'Meals',
        granted: Boolean(mealPlan),
        detail: mealPlan ?? 'No meal plan',
      },
      { key: 'coworking', label: 'Coworking', granted: true, detail: '24/7 access' },
      { key: 'gym', label: 'Gym', granted: true, detail: 'Included with membership' },
      { key: 'pool', label: 'Pool', granted: true, detail: 'Included with membership' },
      {
        key: 'beach-club',
        label: 'Beach Club',
        granted: residencyVerified,
        detail: residencyVerified ? 'Included via Próspera residency' : 'Needs verified E-Residency',
      },
      {
        key: 'cleaning',
        label: 'Cleaning',
        granted: Boolean(cleaning?.frequency),
        detail: cleaning?.frequency ?? 'Not scheduled',
      },
      { key: 'vehicles', label: 'Community vehicles', granted: true, detail: 'Can book free of charge' },
    ];

    return {
      valid: true as const,
      fullName: user.profile?.fullName ?? user.email.split('@')[0],
      membershipStatus,
      unitNumber,
      memberSince: user.membership?.activatedAt ?? user.createdAt,
      access,
      // Rendered as a live clock on the pass page so a screenshot of someone
      // else's pass is visibly stale to whoever is checking it.
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * The member's own pass. Mints the token on first call so we don't have to
   * backfill every account, and returns the full URL the QR should encode.
   */
  async getMyPass(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passToken: true, membership: { select: { status: true } } },
    });
    if (!user) throw new NotFoundException('User not found.');

    let token = user.passToken;
    if (!token) {
      token = randomBytes(16).toString('hex');
      await this.prisma.user.update({ where: { id: userId }, data: { passToken: token } });
    }

    return {
      token,
      url: `${this.frontendBaseUrl()}/pass/${token}`,
      active: user.membership?.status === 'ACTIVE_MEMBER',
    };
  }

  /** Issue a fresh token — used when a phone is lost. Invalidates the old QR. */
  async rotatePass(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found.');
    const token = randomBytes(16).toString('hex');
    await this.prisma.user.update({ where: { id: userId }, data: { passToken: token } });
    return { token, url: `${this.frontendBaseUrl()}/pass/${token}` };
  }

  private frontendBaseUrl(): string {
    return (process.env.FRONTEND_URL ?? 'https://buildersnode.com').replace(/\/$/, '');
  }

  /**
   * Return the time slots the member can book for cleaning. Reads them from
   * ProsperaSub's cleaning_packages catalog — specifically from the active
   * global cleaning plan (if set) so both member's plan and slots stay in
   * sync. Falls back to a default list so the UI is always usable, and
   * always includes `source: 'prospera' | 'default'` so the frontend can
   * hint the user when it's a stale fallback.
   */
  async getCleaningSlots(): Promise<{ slots: string[]; source: 'prospera' | 'default'; packageId: string | null }> {
    const globalCleaningRow = await this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_CLEANING_PLAN_KEY } });
    const globalCleaningPlan = parseGlobalCleaningPlan(globalCleaningRow?.value);

    try {
      const packages = await this.prosperaSub.getCleaningSchedule('public');
      // Prefer the package the admin picked globally; otherwise the first one.
      const active = (globalCleaningPlan
        ? packages.find((p) => p.id === globalCleaningPlan.id)
        : null) ?? packages[0] ?? null;
      const slots = active?.timeSlots ?? [];
      if (slots.length > 0) {
        return { slots, source: 'prospera', packageId: active?.id ?? null };
      }
    } catch {
      /* fall through to default */
    }
    return { slots: DEFAULT_CLEANING_SLOTS, source: 'default', packageId: globalCleaningPlan?.id ?? null };
  }
}
