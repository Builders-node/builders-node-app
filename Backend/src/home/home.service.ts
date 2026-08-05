import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { resolveFrontendBaseUrl } from '../common/frontend-url';
import { PrismaService } from '../database/prisma.service';
import { ProsperaSubClient } from '../subscriptions/prospera-sub.client';
import {
  GLOBAL_CLEANING_PLAN_KEY,
  GLOBAL_MEAL_PLAN_KEY,
  parseGlobalCleaningPlan,
  parseGlobalMealPlan,
} from '../admin/global-settings';

/**
 * Used only when ProsperaSub can't be reached.
 *
 * These mirror the windows actually published in cleaning_available_slots
 * (08:00-09:45, 10:00-11:45, 12:00-13:45, 14:00-15:45). The previous defaults
 * — 09/11/13/15/17 — were invented, so a member picking one chose an hour no
 * cleaner works, and 17:00 doesn't exist at all.
 */
const DEFAULT_CLEANING_SLOTS: Array<{ startTime: string; endTime: string | null }> = [
  { startTime: '08:00', endTime: '09:45' },
  { startTime: '10:00', endTime: '11:45' },
  { startTime: '12:00', endTime: '13:45' },
  { startTime: '14:00', endTime: '15:45' },
];

/** Sunday-first, matching JS `Date.getDay()`. */
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Próspera is UTC-6 with no DST, so a fixed offset is exact. The slot the member
 * picks is a wall-clock time at the residence — where the cleaner actually
 * turns up — not a time in whatever timezone their laptop is set to.
 */
const RESIDENCE_UTC_OFFSET_HOURS = -6;

/** Long enough for door codes and pet instructions, short enough to stay a note. */
const MAX_MEMBER_NOTE = 500;

/**
 * The next time the given weekly slot comes round, as a UTC instant.
 *
 * Derived rather than stored: a standing weekly booking has no single "next
 * date" to keep up to date, and a stored one goes stale the moment it passes.
 */
export function nextOccurrence(weekday: number, timeSlot: string, from = new Date()): Date {
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const offsetMs = RESIDENCE_UTC_OFFSET_HOURS * 3600 * 1000;
  // Work in residence-local terms by shifting, then shift back at the end.
  const local = new Date(from.getTime() + offsetMs);
  const candidate = new Date(local);
  candidate.setUTCHours(hours || 0, minutes || 0, 0, 0);
  const daysAhead = (weekday - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  // Same weekday but the slot has already passed today → a week out.
  if (candidate.getTime() <= local.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 7);
  return new Date(candidate.getTime() - offsetMs);
}

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

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
            // Derived from the standing slot when there is one, so Home never
            // shows a "next cleaning" date that has already been and gone.
            nextCleaning:
              cleaning.weekday != null && cleaning.timeSlot
                ? nextOccurrence(cleaning.weekday, cleaning.timeSlot)
                : cleaning.nextCleaning,
            frequency: cleaning.frequency,
            notes: cleaning.notes,
            weekday: cleaning.weekday,
            weekdayName: cleaning.weekday != null ? WEEKDAY_NAMES[cleaning.weekday] : null,
            timeSlot: cleaning.timeSlot,
            booked: cleaning.weekday != null && Boolean(cleaning.timeSlot),
          }
        : globalCleaningPlan
          ? {
              source: 'ProsperaSub.com',
              nextCleaning: null,
              frequency: globalCleaningPlan.serviceFrequency,
              notes: globalCleaningPlan.name,
              weekday: null,
              weekdayName: null,
              timeSlot: null,
              booked: false,
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
    return resolveFrontendBaseUrl(process.env.FRONTEND_URL, 'https://buildersnode.com');
  }

  /**
   * The windows a member can book cleaning in.
   *
   * Read from ProsperaSub's `cleaning_available_slots` — the table the cleaning
   * team actually publishes availability into. It used to read `time_slots` off
   * `cleaning_packages`, a column that has never existed, so the real times were
   * never once shown: every member saw the hardcoded fallback.
   *
   * `source` tells the frontend whether these are live or our stand-in, so an
   * outage can be said out loud instead of silently changing what people book.
   */
  async getCleaningSlots(): Promise<{
    slots: string[];
    windows: Array<{ startTime: string; endTime: string | null }>;
    source: 'prospera' | 'default';
    packageId: string | null;
  }> {
    const globalCleaningRow = await this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_CLEANING_PLAN_KEY } });
    const globalCleaningPlan = parseGlobalCleaningPlan(globalCleaningRow?.value);
    const packageId = globalCleaningPlan?.id ?? null;

    try {
      const windows = await this.prosperaSub.getCleaningTimeSlots();
      if (windows.length > 0) {
        return { slots: windows.map((w) => w.startTime), windows, source: 'prospera', packageId };
      }
      // Reached the provider, but nothing is published. Different problem from
      // the provider being down, and worth saying which.
      this.logger.warn('ProsperaSub published no active cleaning slots; serving defaults.');
    } catch (error) {
      // When ProsperaSub is down every member is quietly shown times nobody
      // scheduled, and without this nothing anywhere says so.
      this.logger.error(
        `ProsperaSub cleaning slots unavailable; serving defaults. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      slots: DEFAULT_CLEANING_SLOTS.map((w) => w.startTime),
      windows: DEFAULT_CLEANING_SLOTS,
      source: 'default',
      packageId,
    };
  }

  /**
   * The member's standing weekly cleaning slot, with the slots they can choose
   * from so the picker needs one request rather than two.
   */
  async getMyCleaning(userId: string) {
    const [schedule, catalog] = await Promise.all([
      this.prisma.cleaningSchedule.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.getCleaningSlots(),
    ]);

    const booked = schedule?.weekday != null && Boolean(schedule.timeSlot);
    return {
      booked,
      weekday: schedule?.weekday ?? null,
      weekdayName: schedule?.weekday != null ? WEEKDAY_NAMES[schedule.weekday] : null,
      timeSlot: schedule?.timeSlot ?? null,
      // Recomputed on read: a standing weekly slot has no stored "next" that
      // stays true, and the member should never see a date that has passed.
      nextCleaning: booked ? nextOccurrence(schedule!.weekday!, schedule!.timeSlot!) : (schedule?.nextCleaning ?? null),
      frequency: schedule?.frequency ?? null,
      notes: schedule?.notes ?? null,
      memberNote: schedule?.memberNote ?? null,
      slots: catalog.slots,
      // The end times too, so the picker can show "08:00 – 09:45" rather than
      // implying a cleaner turns up for an unspecified length of time.
      windows: catalog.windows,
      slotsSource: catalog.source,
    };
  }

  /**
   * Set (or move) the weekly slot. One row per member, upserted — booking is a
   * standing arrangement, not a queue of requests, so booking again replaces
   * the slot instead of stacking up another one.
   */
  async setMyCleaning(userId: string, input: { weekday?: unknown; timeSlot?: unknown; memberNote?: unknown }) {
    const weekday = Number(input.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new BadRequestException('Pick a day of the week.');
    }
    const timeSlot = String(input.timeSlot ?? '').trim();
    if (!/^\d{2}:\d{2}$/.test(timeSlot)) {
      throw new BadRequestException('Pick a time slot.');
    }
    // Only slots the provider actually offers — a hand-crafted request must not
    // book a time no cleaner is scheduled for.
    const { slots } = await this.getCleaningSlots();
    if (!slots.includes(timeSlot)) {
      throw new BadRequestException('That time slot is not available.');
    }

    const existing = await this.prisma.cleaningSchedule.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    // Anything the cleaner should know. Capped so a stray paste can't fill the
    // column; blank clears it rather than leaving a note the member deleted.
    const memberNote = String(input.memberNote ?? '').trim().slice(0, MAX_MEMBER_NOTE) || null;

    const data = {
      weekday,
      timeSlot,
      memberNote,
      bookedAt: new Date(),
      nextCleaning: nextOccurrence(weekday, timeSlot),
      frequency: 'Weekly',
    };

    if (existing) {
      await this.prisma.cleaningSchedule.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.cleaningSchedule.create({ data: { ...data, userId } });
    }

    return this.getMyCleaning(userId);
  }
}
