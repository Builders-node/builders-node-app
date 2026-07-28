import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { buildCredentialInvitation } from '../auth/invitation';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { createReferralCode } from '../users/referral-code';
import { isUserRole } from '../users/roles';
import { ProsperaSubClient } from '../subscriptions/prospera-sub.client';
import {
  BATCH_KEY,
  GLOBAL_CLEANING_PLAN_KEY,
  GLOBAL_MEAL_PLAN_KEY,
  parseBatch,
  parseGlobalCleaningPlan,
  parseGlobalMealPlan,
  type GlobalCleaningPlan,
  type GlobalMealPlan,
} from './global-settings';

const MEMBERSHIP_STATUSES = new Set([
  'APPLICANT',
  'APPROVED',
  'ACTIVE_MEMBER',
  'PAST_MEMBER',
  'CANCELLED',
  'SUSPENDED',
]);

const APARTMENT_AVAILABILITY = new Set([
  'AVAILABLE',
  'AVAILABLE_SOON',
  'ASSIGNED',
  'OCCUPIED',
  'MAINTENANCE',
  'UNAVAILABLE',
]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prosperaSub: ProsperaSubClient,
    private readonly mail: MailService,
  ) {}

  async overview() {
    const now = new Date();
    const weekStart = this.startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [applications, users, paidPayments] = await Promise.all([
      this.prisma.application.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          membership: true,
          residencyApplication: true,
          assignedApartment: { include: { apartment: true } },
          mealMenuItems: { orderBy: { createdAt: 'desc' }, take: 1 },
          cleaningSchedules: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'PAID',
          paidAt: { not: null },
        },
        select: {
          amountCents: true,
          currency: true,
          paidAt: true,
        },
      }),
    ]);
    const income = this.buildIncomeSummary(paidPayments, { weekStart, monthStart, yearStart });

    return {
      metrics: {
        applications: applications.length,
        users: users.length,
        pendingSetup: users.filter((user) => user.mustChangePassword).length,
        activeMembers: users.filter((user) => user.membership?.status === 'ACTIVE_MEMBER').length,
      },
      income,
      applications,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        referralCode: user.referralCode,
        role: user.role,
        fullName: user.profile?.fullName,
        membershipStatus: user.membership?.status,
        residencyStatus: user.residencyApplication?.status ?? 'NOT_STARTED',
        apartment: user.assignedApartment?.apartment.name,
        mealPlan: user.mealMenuItems[0]?.meal,
        cleaningPlan: user.cleaningSchedules[0]?.notes,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
      })),
    };
  }

  async userDetail(userId: string) {
    const [user, referredApplications] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          membership: true,
          residencyApplication: true,
          subscriptionPlan: true,
          communityPlans: { orderBy: { purchasedAt: 'desc' } },
          payments: { orderBy: { dueDate: 'desc' } },
          rentalRequests: {
            orderBy: { createdAt: 'desc' },
            include: { apartment: true },
          },
          assignedApartment: { include: { apartment: true } },
          mealMenuItems: { orderBy: { createdAt: 'desc' } },
          cleaningSchedules: { orderBy: { createdAt: 'desc' } },
          supportTickets: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.application.findMany({
        where: { referredByUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const paidTotalCents = user.payments
      .filter((payment) => payment.status === 'PAID')
      .reduce((sum, payment) => sum + payment.amountCents, 0);

    return {
      id: user.id,
      email: user.email,
      referralCode: user.referralCode,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile,
      membership: user.membership,
      residencyApplication: user.residencyApplication
        ? {
            ...user.residencyApplication,
            requiredNextSteps: this.parseJsonArray(user.residencyApplication.requiredNextStepsJson),
          }
        : null,
      subscriptionPlan: user.subscriptionPlan,
      communityPlans: user.communityPlans,
      assignedApartment: user.assignedApartment,
      meals: user.mealMenuItems,
      cleaningSchedules: user.cleaningSchedules,
      payments: user.payments,
      rentalRequests: user.rentalRequests,
      supportTickets: user.supportTickets,
      referredApplications,
      summary: {
        paidTotalCents,
        openPayments: user.payments.filter((payment) => payment.status === 'DUE' || payment.status === 'OVERDUE').length,
        supportTickets: user.supportTickets.length,
        rentalRequests: user.rentalRequests.length,
      },
    };
  }

  async setApartmentAvailability(applicationId: string, available: boolean) {
    const application = await this.requireApplication(applicationId);
    const status = available ? 'APARTMENT_AVAILABLE' : 'NO_APARTMENT_AVAILABLE';

    return this.prisma.application.update({
      where: { id: application.id },
      data: {
        apartmentAvailable: available,
        status,
      },
    });
  }

  async firstCheck(applicationId: string, approved: boolean) {
    const application = await this.requireApplication(applicationId);
    const now = new Date();

    return this.prisma.application.update({
      where: { id: application.id },
      data: approved
        ? {
            status: 'FIRST_APPROVED',
            firstApprovedAt: now,
            approvedAt: application.approvedAt ?? now,
          }
        : {
            status: 'FIRST_REJECTED',
          },
    });
  }

  async onlineMeetingCheck(applicationId: string, approved: boolean) {
    const application = await this.requireApplication(applicationId);
    if (application.status === 'FIRST_REJECTED') {
      throw new BadRequestException('First check rejected this application.');
    }

    return this.prisma.application.update({
      where: { id: application.id },
      data: approved
        ? {
            status: 'MEETING_APPROVED',
            meetingApprovedAt: new Date(),
          }
        : {
            status: 'MEETING_REJECTED',
          },
    });
  }

  async sendPaymentLink(applicationId: string, paymentLink?: string) {
    const application = await this.requireApplication(applicationId);
    if (!application.apartmentAvailable) {
      throw new BadRequestException('Confirm apartment availability before sending a payment link.');
    }
    if (application.status !== 'MEETING_APPROVED' && application.status !== 'APARTMENT_AVAILABLE') {
      throw new BadRequestException('Approve the online meeting before sending a payment link.');
    }

    const link = paymentLink?.trim() || 'https://prosperasub.com/builders-node/pay';
    const updated = await this.prisma.application.update({
      where: { id: application.id },
      data: {
        status: 'PAYMENT_LINK_SENT',
        paymentStatus: 'PENDING',
        paymentLink: link,
        paymentLinkSentAt: new Date(),
      },
    });

    return {
      application: updated,
      email: {
        to: application.email,
        subject: 'Builders Node payment link',
        body: `Your Builders Node application is approved for the next step. Complete payment here: ${link}`,
      },
    };
  }

  async confirmPayment(applicationId: string) {
    const application = await this.requireApplication(applicationId);
    if (application.status !== 'PAYMENT_LINK_SENT' && application.paymentStatus !== 'PENDING') {
      throw new BadRequestException('Send a payment link before confirming payment.');
    }

    return this.prisma.application.update({
      where: { id: application.id },
      data: {
        status: 'PAYMENT_CONFIRMED',
        paymentStatus: 'SUCCESS',
        paymentConfirmedAt: new Date(),
      },
    });
  }

  async sendCredentials(applicationId: string) {
    const application = await this.requireApplication(applicationId);
    if (application.paymentStatus !== 'SUCCESS') {
      throw new BadRequestException('Confirm successful payment before sending create-password credentials.');
    }

    const temporaryPassword = `BuildersNode-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const dates = this.defaultMembershipDates();
    const user = await this.prisma.user.upsert({
      where: { email: application.email },
      create: {
        email: application.email,
        passwordHash,
        referralCode: createReferralCode(),
        mustChangePassword: true,
        profile: {
          create: {
            fullName: application.fullName,
            phone: application.phone,
          },
        },
        membership: {
          create: {
            status: 'APPROVED',
            approvedAt: new Date(),
            startingDate: dates.startingDate,
            dueDate: dates.dueDate,
            finishDate: dates.finishDate,
          },
        },
      },
      update: {
        passwordHash,
        mustChangePassword: true,
        profile: {
          upsert: {
            create: {
              fullName: application.fullName,
              phone: application.phone,
            },
            update: {
              fullName: application.fullName,
              phone: application.phone,
            },
          },
        },
        membership: {
          upsert: {
            create: {
              status: 'APPROVED',
              approvedAt: new Date(),
              startingDate: dates.startingDate,
              dueDate: dates.dueDate,
              finishDate: dates.finishDate,
            },
            update: {
              status: 'APPROVED',
              approvedAt: new Date(),
              startingDate: dates.startingDate,
              dueDate: dates.dueDate,
              finishDate: dates.finishDate,
            },
          },
        },
      },
    });
    const userWithReferral = user.referralCode
      ? user
      : await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: createReferralCode() },
        });

    const token = randomUUID();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: userWithReferral.id,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        status: 'CREDENTIALS_SENT',
        approvedAt: application.approvedAt ?? new Date(),
      },
    });

    // On approval, automatically grant the global ProsperaSub.com meal plan the
    // member already paid for, and provision their ProsperaSub.com account.
    const provisioning = await this.provisionApprovedMember({
      id: userWithReferral.id,
      email: userWithReferral.email,
      fullName: application.fullName,
    });

    const invitation = buildCredentialInvitation({
      email: userWithReferral.email,
      token,
      temporaryPassword,
      frontendUrl: this.mail.frontendBaseUrl(),
    });
    await this.mail.sendInvitation(invitation);

    return { userId: userWithReferral.id, provisioning, invitation };
  }

  /**
   * Grant the approved member the global meal plan (snapshot of what they paid
   * for) and provision them on ProsperaSub.com. Never throws — provisioning
   * failures are recorded as an audit event so approval still completes.
   */
  private async provisionApprovedMember(user: { id: string; email: string; fullName?: string | null }) {
    const [globalMealRow, globalCleaningRow] = await Promise.all([
      this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_MEAL_PLAN_KEY } }),
      this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_CLEANING_PLAN_KEY } }),
    ]);
    const mealPlan = parseGlobalMealPlan(globalMealRow?.value);
    const cleaningPlan = parseGlobalCleaningPlan(globalCleaningRow?.value);

    // Issue the food locally so the member sees their paid meal plan immediately.
    if (mealPlan) {
      await this.prisma.mealMenuItem.deleteMany({ where: { userId: user.id } });
      await this.prisma.mealMenuItem.create({
        data: { userId: user.id, day: 'Plan', meal: mealPlan.name, source: 'ProsperaSub.com' },
      });
    }

    // Issue the cleaning plan locally as well.
    if (cleaningPlan) {
      await this.prisma.cleaningSchedule.deleteMany({ where: { userId: user.id } });
      await this.prisma.cleaningSchedule.create({
        data: {
          userId: user.id,
          frequency: cleaningPlan.serviceFrequency ?? 'Designated',
          nextCleaning: new Date(),
          notes: cleaningPlan.name,
          source: 'ProsperaSub.com',
        },
      });
    }

    let result: { status: string; externalAccountId: string | null; message: string };
    try {
      result = await this.prosperaSub.provisionMember({
        email: user.email,
        fullName: user.fullName,
        mealPlanId: mealPlan?.id ?? null,
        mealPlanName: mealPlan?.name ?? null,
        cleaningPlanId: cleaningPlan?.id ?? null,
        cleaningPlanName: cleaningPlan?.name ?? null,
      });
    } catch (error) {
      result = {
        status: 'FAILED',
        externalAccountId: null,
        message: error instanceof Error ? error.message : 'ProsperaSub.com provisioning failed.',
      };
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'prospera_sub_provision',
        metadataJson: JSON.stringify({ ...result, mealPlanId: mealPlan?.id ?? null, cleaningPlanId: cleaningPlan?.id ?? null }),
      },
    });

    return { ...result, mealPlan, cleaningPlan };
  }

  async designateUser(
    userId: string,
    body: { apartmentName?: string; mealPlan?: string; cleaningPlan?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const apartmentName = body.apartmentName?.trim();
    const mealPlan = body.mealPlan?.trim();
    const cleaningPlan = body.cleaningPlan?.trim();

    if (!apartmentName && !mealPlan && !cleaningPlan) {
      throw new BadRequestException('Add an apartment, meal plan, or cleaning plan.');
    }

    return this.prisma.$transaction(async (tx) => {
      let apartment = null;

      if (apartmentName) {
        apartment = await tx.apartment.findFirst({ where: { name: apartmentName } });
        apartment ??= await tx.apartment.create({
          data: {
            name: apartmentName,
            description: 'Designated Builders Node apartment.',
            priceCents: 0,
            availability: 'ASSIGNED',
            bedrooms: 1,
            bathrooms: 1,
          },
        });

        await tx.assignedApartment.upsert({
          where: { userId },
          create: {
            userId,
            apartmentId: apartment.id,
            moveInDate: new Date(),
            notes: 'Designated from admin dashboard.',
          },
          update: {
            apartmentId: apartment.id,
            notes: 'Updated from admin dashboard.',
          },
        });
      }

      if (mealPlan) {
        await tx.mealMenuItem.deleteMany({ where: { userId } });
        await tx.mealMenuItem.create({
          data: {
            userId,
            day: 'Plan',
            meal: mealPlan,
            source: 'ProsperaSub.com',
          },
        });
      }

      if (cleaningPlan) {
        await tx.cleaningSchedule.deleteMany({ where: { userId } });
        await tx.cleaningSchedule.create({
          data: {
            userId,
            frequency: 'Designated',
            nextCleaning: new Date(),
            notes: cleaningPlan,
            source: 'ProsperaSub.com',
          },
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          assignedApartment: { include: { apartment: true } },
          mealMenuItems: true,
          cleaningSchedules: true,
        },
      });
    });
  }

  /**
   * Global community settings for the admin Settings page. Returns the currently
   * selected global ProsperaSub.com meal plan plus the live list of meal options
   * to choose from.
   */
  async listResidencyReviews() {
    const apps = await this.prisma.residencyApplication.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'VERIFIED', 'REJECTED'] } },
      orderBy: [{ submittedAt: 'desc' }],
      include: { user: { include: { profile: true } } },
    });
    return apps.map((a) => ({
      userId: a.userId,
      email: a.user.email,
      fullName: a.user.profile?.fullName ?? null,
      status: a.status,
      proofFileName: a.proofFileName,
      submittedAt: a.submittedAt,
      reviewedAt: a.reviewedAt,
      reviewNote: a.reviewNote,
    }));
  }

  async reviewResidency(userId: string, decision: string | undefined, note?: string) {
    if (decision !== 'VERIFIED' && decision !== 'REJECTED') {
      throw new BadRequestException('Decision must be VERIFIED or REJECTED.');
    }
    const app = await this.prisma.residencyApplication.findUnique({ where: { userId } });
    if (!app) {
      throw new NotFoundException('No E-Residency submission for this user.');
    }
    await this.prisma.residencyApplication.update({
      where: { userId },
      data: {
        status: decision,
        stage: decision === 'VERIFIED' ? 'Verified' : 'Rejected — resubmit proof',
        reviewedAt: new Date(),
        reviewNote: note?.trim() || null,
      },
    });
    return this.listResidencyReviews();
  }

  async getGlobalSettings() {
    const [mealRow, cleaningRow, batchRow, mealOptions, cleaningOptions, apartments] = await Promise.all([
      this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_MEAL_PLAN_KEY } }),
      this.prisma.globalSetting.findUnique({ where: { key: GLOBAL_CLEANING_PLAN_KEY } }),
      this.prisma.globalSetting.findUnique({ where: { key: BATCH_KEY } }),
      this.prosperaSub.getMealsMenu('admin').catch(() => []),
      this.prosperaSub.getCleaningSchedule('admin').catch(() => []),
      this.prisma.apartment.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

    return {
      mealPlan: parseGlobalMealPlan(mealRow?.value),
      mealOptions,
      cleaningPlan: parseGlobalCleaningPlan(cleaningRow?.value),
      cleaningOptions,
      apartmentOptions: apartments,
      batch: parseBatch(batchRow?.value),
    };
  }

  /** Set the batch start date (ISO YYYY-MM-DD) and optional label shown on the landing. */
  async setBatch(body: { startDate?: string; label?: string }) {
    const startDate = body.startDate?.trim();
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new BadRequestException('Batch start date must be a valid date.');
    }
    const value = JSON.stringify({ startDate: startDate || null, label: body.label?.trim() || null });
    await this.prisma.globalSetting.upsert({
      where: { key: BATCH_KEY },
      create: { key: BATCH_KEY, value },
      update: { value },
    });
    return this.getGlobalSettings();
  }

  /**
   * Set the single global meal plan that applies to every member automatically.
   * Either pick a ProsperaSub.com catalog plan by id, or define a custom plan
   * (planId === 'custom') with your own name / weekly price / portions — use this
   * when the ProsperaSub.com catalog data is wrong or incomplete. Empty planId
   * clears the global plan.
   */
  async setGlobalMealPlan(
    planId: string | undefined,
    custom?: { name?: string; weeklyPriceCents?: number; mealsLabel?: string },
  ) {
    const id = planId?.trim();

    if (!id) {
      await this.prisma.globalSetting.deleteMany({ where: { key: GLOBAL_MEAL_PLAN_KEY } });
      return this.getGlobalSettings();
    }

    let plan: GlobalMealPlan;

    if (id === 'custom') {
      const name = custom?.name?.trim();
      if (!name) {
        throw new BadRequestException('Enter a name for the custom meal plan.');
      }
      const weeklyPriceCents =
        typeof custom?.weeklyPriceCents === 'number' && Number.isFinite(custom.weeklyPriceCents)
          ? Math.max(0, Math.round(custom.weeklyPriceCents))
          : null;

      plan = {
        id: 'custom',
        name,
        description: null,
        weeklyPriceCents,
        mealsPerWeek: null,
        mealsPerDay: null,
        daysPerWeek: null,
        mealsLabel: custom?.mealsLabel?.trim() || null,
        deliveryInfo: null,
        location: null,
        imageUrl: null,
      };
    } else {
      const options = await this.prosperaSub.getMealsMenu('admin');
      const chosen = options.find((option) => option.id === id);
      if (!chosen) {
        throw new BadRequestException('That meal plan is not available on ProsperaSub.com.');
      }

      plan = {
        id: chosen.id,
        name: chosen.name,
        description: chosen.description,
        weeklyPriceCents: chosen.weeklyPriceCents,
        mealsPerWeek: chosen.mealsPerWeek,
        mealsPerDay: chosen.mealsPerDay,
        daysPerWeek: chosen.daysPerWeek,
        mealsLabel: null,
        deliveryInfo: chosen.deliveryInfo,
        location: chosen.location,
        imageUrl: chosen.imageUrl,
      };
    }

    await this.prisma.globalSetting.upsert({
      where: { key: GLOBAL_MEAL_PLAN_KEY },
      create: { key: GLOBAL_MEAL_PLAN_KEY, value: JSON.stringify(plan) },
      update: { value: JSON.stringify(plan) },
    });

    return this.getGlobalSettings();
  }

  /**
   * Pick a single global ProsperaSub.com cleaning plan that applies to every
   * member automatically. Pass an empty/undefined planId to clear it.
   */
  async setGlobalCleaningPlan(planId: string | undefined) {
    const id = planId?.trim();

    if (!id) {
      await this.prisma.globalSetting.deleteMany({ where: { key: GLOBAL_CLEANING_PLAN_KEY } });
      return this.getGlobalSettings();
    }

    const options = await this.prosperaSub.getCleaningSchedule('admin');
    const chosen = options.find((option) => option.id === id);
    if (!chosen) {
      throw new BadRequestException('That cleaning plan is not available on ProsperaSub.com.');
    }

    const plan: GlobalCleaningPlan = {
      id: chosen.id,
      name: chosen.name,
      shortDescription: chosen.shortDescription,
      description: chosen.description,
      pricePerCleaningCents: chosen.pricePerCleaningCents,
      monthlyPriceCents: chosen.monthlyPriceCents,
      cleaningsPerMonth: chosen.cleaningsPerMonth,
      serviceFrequency: chosen.serviceFrequency,
      apartmentType: chosen.apartmentType,
    };

    await this.prisma.globalSetting.upsert({
      where: { key: GLOBAL_CLEANING_PLAN_KEY },
      create: { key: GLOBAL_CLEANING_PLAN_KEY, value: JSON.stringify(plan) },
      update: { value: JSON.stringify(plan) },
    });

    return this.getGlobalSettings();
  }

  async updateUserRole(userId: string, role: string | undefined, actor?: { role: string; via: 'key' | 'session' }) {
    if (actor?.via !== 'key' && actor?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can change roles.');
    }

    if (!isUserRole(role)) {
      throw new BadRequestException('Choose a valid role.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        profile: true,
        membership: true,
      },
    });
  }

  /**
   * Edit a user's profile (name/phone/location), membership status, and — for a
   * Super Admin — their role. Returns the refreshed user detail.
   */
  async updateUser(
    userId: string,
    body: { fullName?: string; phone?: string; location?: string; membershipStatus?: string; role?: string },
    actor?: { userId?: string; role: string; via: 'key' | 'session' },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const roleChanged = typeof body.role === 'string' && body.role !== user.role;
    if (roleChanged) {
      if (actor?.via !== 'key' && actor?.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only Super Admin can change roles.');
      }
      if (!isUserRole(body.role)) {
        throw new BadRequestException('Choose a valid role.');
      }
    }

    const membershipStatus = body.membershipStatus?.trim();
    if (membershipStatus && !MEMBERSHIP_STATUSES.has(membershipStatus)) {
      throw new BadRequestException('Choose a valid membership status.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          fullName: body.fullName?.trim() || null,
          phone: body.phone?.trim() || null,
          location: body.location?.trim() || null,
        },
        update: {
          ...(body.fullName !== undefined ? { fullName: body.fullName.trim() || null } : {}),
          ...(body.phone !== undefined ? { phone: body.phone.trim() || null } : {}),
          ...(body.location !== undefined ? { location: body.location.trim() || null } : {}),
        },
      });

      if (membershipStatus) {
        await tx.membership.upsert({
          where: { userId },
          create: { userId, status: membershipStatus },
          update: { status: membershipStatus },
        });
      }

      if (roleChanged) {
        await tx.user.update({ where: { id: userId }, data: { role: body.role } });
      }
    });

    return this.userDetail(userId);
  }

  /**
   * Manually create a member account from the admin panel. Generates a temporary
   * password + setup link (returned so the admin can share it). The person sets
   * their own password via the setup link on first login.
   */
  async createUser(
    body: { email?: string; fullName?: string; phone?: string; location?: string; role?: string; membershipStatus?: string },
    actor?: { userId?: string; role: string; via: 'key' | 'session' },
  ) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('A valid email is required.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('A user with this email already exists.');
    }

    let role = 'MEMBER';
    if (body.role && body.role !== 'MEMBER') {
      if (actor?.via !== 'key' && actor?.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only Super Admin can assign roles.');
      }
      if (!isUserRole(body.role)) {
        throw new BadRequestException('Choose a valid role.');
      }
      role = body.role;
    }

    const membershipStatus = body.membershipStatus?.trim() || 'ACTIVE_MEMBER';
    if (!MEMBERSHIP_STATUSES.has(membershipStatus)) {
      throw new BadRequestException('Choose a valid membership status.');
    }

    const temporaryPassword = `BuildersNode-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const dates = this.defaultMembershipDates();

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        referralCode: createReferralCode(),
        mustChangePassword: true,
        profile: {
          create: {
            fullName: body.fullName?.trim() || null,
            phone: body.phone?.trim() || null,
            location: body.location?.trim() || null,
          },
        },
        membership: {
          create: {
            status: membershipStatus,
            approvedAt: new Date(),
            startingDate: dates.startingDate,
            dueDate: dates.dueDate,
            finishDate: dates.finishDate,
          },
        },
      },
    });

    const token = randomUUID();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
    });

    const invitation = buildCredentialInvitation({
      email,
      token,
      temporaryPassword,
      frontendUrl: this.mail.frontendBaseUrl(),
    });
    await this.mail.sendInvitation(invitation);

    return { userId: user.id, invitation };
  }

  /**
   * Permanently delete a user account and all data owned by it. Restricted to a
   * Super Admin, and an admin cannot delete their own account. Related rows are
   * removed explicitly so the delete is safe regardless of DB-level cascades.
   */
  async deleteUser(userId: string, actor?: { userId?: string; role: string; via: 'key' | 'session' }) {
    if (actor?.via !== 'key' && actor?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can delete accounts.');
    }
    if (actor?.userId && actor.userId === userId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.$transaction((tx) => this.purgeUser(tx as PrismaService, userId));

    return { deleted: true, id: userId, email: user.email };
  }

  /**
   * Delete several user accounts at once (Super Admin only). Skips the actor's own
   * account and any ids that no longer exist; runs as a single transaction.
   */
  async deleteUsers(userIds: string[], actor?: { userId?: string; role: string; via: 'key' | 'session' }) {
    if (actor?.via !== 'key' && actor?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can delete accounts.');
    }

    const uniqueIds = Array.from(new Set(userIds ?? [])).filter((id) => typeof id === 'string' && id.length > 0);
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one account to delete.');
    }

    const targetIds = uniqueIds.filter((id) => id !== actor?.userId);
    const skippedSelf = targetIds.length !== uniqueIds.length;

    const existing = await this.prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true } });
    const existingIds = existing.map((user) => user.id);

    if (existingIds.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const id of existingIds) {
          await this.purgeUser(tx as PrismaService, id);
        }
      });
    }

    return { deleted: existingIds.length, ids: existingIds, skippedSelf };
  }

  /** Remove a user and every row owned by it. Runs inside a caller-provided transaction. */
  private async purgeUser(tx: PrismaService, userId: string) {
    const where = { userId };
    await tx.auditEvent.updateMany({ where, data: { userId: null } });
    await tx.mealMenuItem.deleteMany({ where });
    await tx.cleaningSchedule.deleteMany({ where });
    await tx.rentalRequest.deleteMany({ where });
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

  /** All units with availability status and who (if anyone) is assigned. */
  async listApartments() {
    const apartments = await this.prisma.apartment.findMany({
      orderBy: [{ availability: 'asc' }, { name: 'asc' }],
      include: {
        assignments: { include: { user: { include: { profile: true } } } },
        unitType: { select: { id: true, name: true } },
        _count: { select: { rentalRequests: true } },
      },
    });

    const items = apartments.map((apartment) => {
      const occupants = apartment.assignments.map((assignment) => ({
        userId: assignment.userId,
        name: assignment.user.profile?.fullName ?? assignment.user.email,
        email: assignment.user.email,
        moveInDate: assignment.moveInDate,
      }));

      return {
        id: apartment.id,
        name: apartment.name,
        description: apartment.description,
        availability: apartment.availability,
        bedrooms: apartment.bedrooms,
        bathrooms: apartment.bathrooms,
        squareFeet: apartment.squareFeet,
        priceCents: apartment.priceCents,
        currency: apartment.currency,
        availableFrom: apartment.availableFrom,
        unitType: apartment.unitType,
        occupants,
        openRequests: apartment._count.rentalRequests,
      };
    });

    const summary = {
      total: items.length,
      available: items.filter((item) => item.availability === 'AVAILABLE' || item.availability === 'AVAILABLE_SOON').length,
      occupied: items.filter((item) => item.occupants.length > 0).length,
      unavailable: items.filter((item) => item.availability === 'UNAVAILABLE' || item.availability === 'MAINTENANCE').length,
    };

    return { summary, apartments: items };
  }

  /** Create a new housing unit — optionally from a unit-type template (inherits its price/specs). */
  async createApartment(body: {
    name?: string;
    description?: string;
    priceCents?: number;
    currency?: string;
    availability?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    unitTypeId?: string;
  }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Unit name is required.');
    }
    const availability = body.availability?.trim() || 'AVAILABLE';
    if (!APARTMENT_AVAILABILITY.has(availability)) {
      throw new BadRequestException('Choose a valid availability status.');
    }

    let template: { id: string; priceCents: number; currency: string; bedrooms: number; bathrooms: number; squareFeet: number | null; description: string | null } | null = null;
    if (body.unitTypeId) {
      template = await this.prisma.unitType.findUnique({ where: { id: body.unitTypeId } });
      if (!template) {
        throw new NotFoundException('Unit type not found.');
      }
    }

    await this.prisma.apartment.create({
      data: {
        name,
        description: body.description?.trim() || template?.description || '',
        priceCents: body.priceCents !== undefined ? this.toCents(body.priceCents) : template?.priceCents ?? 0,
        currency: body.currency?.trim() || template?.currency || 'USD',
        availability,
        bedrooms: body.bedrooms !== undefined ? this.toCount(body.bedrooms, 0) : template?.bedrooms ?? 0,
        bathrooms: body.bathrooms !== undefined ? this.toCount(body.bathrooms, 1) : template?.bathrooms ?? 1,
        squareFeet:
          body.squareFeet !== undefined
            ? Number.isFinite(body.squareFeet)
              ? Math.max(0, Math.round(body.squareFeet as number))
              : null
            : template?.squareFeet ?? null,
        unitTypeId: template?.id ?? null,
      },
    });

    return this.listApartments();
  }

  /** Update a unit's fields and/or availability status (partial). */
  async updateApartment(
    apartmentId: string,
    body: {
      name?: string;
      description?: string;
      availability?: string;
      unitTypeId?: string | null;
      // Specs (price/beds/baths/sqft) come from the type template and are not
      // editable per unit; accepted only for custom (typeless) units.
      priceCents?: number;
      currency?: string;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number | null;
    },
  ) {
    const apartment = await this.prisma.apartment.findUnique({ where: { id: apartmentId } });
    if (!apartment) {
      throw new NotFoundException('Unit not found.');
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Unit name is required.');
      data.name = name;
    }
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.availability !== undefined) {
      const status = body.availability.trim();
      if (!APARTMENT_AVAILABILITY.has(status)) throw new BadRequestException('Choose a valid availability status.');
      data.availability = status;
    }

    // Determine whether this unit is (or becomes) linked to a type.
    const nextTypeId = body.unitTypeId !== undefined ? body.unitTypeId || null : apartment.unitTypeId;

    if (nextTypeId) {
      const template = await this.prisma.unitType.findUnique({ where: { id: nextTypeId } });
      if (!template) throw new NotFoundException('Unit type not found.');
      // Specs always come from the type template.
      data.unitTypeId = template.id;
      data.priceCents = template.priceCents;
      data.currency = template.currency;
      data.bedrooms = template.bedrooms;
      data.bathrooms = template.bathrooms;
      data.squareFeet = template.squareFeet;
      if (body.description === undefined && template.description !== null) {
        data.description = template.description;
      }
    } else {
      if (body.unitTypeId !== undefined) data.unitTypeId = null;
      // Typeless (custom) unit — allow manual specs.
      if (body.currency !== undefined) data.currency = body.currency.trim() || 'USD';
      if (body.priceCents !== undefined) data.priceCents = this.toCents(body.priceCents);
      if (body.bedrooms !== undefined) data.bedrooms = this.toCount(body.bedrooms, 0);
      if (body.bathrooms !== undefined) data.bathrooms = this.toCount(body.bathrooms, 0);
      if (body.squareFeet !== undefined) {
        data.squareFeet = Number.isFinite(body.squareFeet) ? Math.max(0, Math.round(body.squareFeet as number)) : null;
      }
    }

    await this.prisma.apartment.update({ where: { id: apartmentId }, data });
    return this.listApartments();
  }

  /** Delete a unit. Blocked while residents are assigned; drops open rental requests. */
  async deleteApartment(apartmentId: string) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: { _count: { select: { assignments: true } } },
    });
    if (!apartment) {
      throw new NotFoundException('Unit not found.');
    }
    if (apartment._count.assignments > 0) {
      throw new BadRequestException('This unit is occupied. Reassign residents before deleting it.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rentalRequest.deleteMany({ where: { apartmentId } });
      await tx.apartment.delete({ where: { id: apartmentId } });
    });

    return this.listApartments();
  }

  /** Apartment type templates (e.g. Studio, 1 Bedroom) with shared price + specs. */
  async listUnitTypes() {
    const types = await this.prisma.unitType.findMany({
      orderBy: { priceCents: 'asc' },
      include: { _count: { select: { apartments: true } } },
    });
    return types.map((type) => ({
      id: type.id,
      name: type.name,
      priceCents: type.priceCents,
      currency: type.currency,
      bedrooms: type.bedrooms,
      bathrooms: type.bathrooms,
      squareFeet: type.squareFeet,
      description: type.description,
      unitCount: type._count.apartments,
    }));
  }

  async createUnitType(body: { name?: string; priceCents?: number; bedrooms?: number; bathrooms?: number; squareFeet?: number; description?: string }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Type name is required.');
    }
    await this.prisma.unitType.create({
      data: {
        name,
        priceCents: this.toCents(body.priceCents),
        bedrooms: this.toCount(body.bedrooms, 0),
        bathrooms: this.toCount(body.bathrooms, 1),
        squareFeet: Number.isFinite(body.squareFeet) ? Math.max(0, Math.round(body.squareFeet as number)) : null,
        description: body.description?.trim() || null,
      },
    });
    return this.listUnitTypes();
  }

  async updateUnitType(id: string, body: { name?: string; priceCents?: number; bedrooms?: number; bathrooms?: number; squareFeet?: number | null; description?: string }) {
    const type = await this.prisma.unitType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException('Unit type not found.');
    }
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Type name is required.');
      data.name = name;
    }
    if (body.priceCents !== undefined) data.priceCents = this.toCents(body.priceCents);
    if (body.bedrooms !== undefined) data.bedrooms = this.toCount(body.bedrooms, 0);
    if (body.bathrooms !== undefined) data.bathrooms = this.toCount(body.bathrooms, 0);
    if (body.squareFeet !== undefined) {
      data.squareFeet = Number.isFinite(body.squareFeet) ? Math.max(0, Math.round(body.squareFeet as number)) : null;
    }
    if (body.description !== undefined) data.description = body.description.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.unitType.update({ where: { id }, data });
      // Propagate the type's specs to every unit that uses it, so a template
      // change updates all its units.
      await tx.apartment.updateMany({
        where: { unitTypeId: id },
        data: {
          priceCents: updated.priceCents,
          currency: updated.currency,
          bedrooms: updated.bedrooms,
          bathrooms: updated.bathrooms,
          squareFeet: updated.squareFeet,
          ...(updated.description !== null ? { description: updated.description } : {}),
        },
      });
    });

    return this.listUnitTypes();
  }

  async deleteUnitType(id: string) {
    const type = await this.prisma.unitType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException('Unit type not found.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.apartment.updateMany({ where: { unitTypeId: id }, data: { unitTypeId: null } });
      await tx.unitType.delete({ where: { id } });
    });
    return this.listUnitTypes();
  }

  /** Assign a member to a unit (moves them from any previous unit; marks the unit OCCUPIED). */
  async assignResident(apartmentId: string, userId: string | undefined, moveInDate?: string) {
    if (!userId) {
      throw new BadRequestException('Choose a member to assign.');
    }
    const [apartment, user] = await Promise.all([
      this.prisma.apartment.findUnique({ where: { id: apartmentId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!apartment) throw new NotFoundException('Unit not found.');
    if (!user) throw new NotFoundException('User not found.');

    const moveIn = moveInDate ? new Date(moveInDate) : new Date();

    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.assignedApartment.findUnique({ where: { userId } });

      await tx.assignedApartment.upsert({
        where: { userId },
        create: { userId, apartmentId, moveInDate: moveIn, notes: 'Assigned from Units page.' },
        update: { apartmentId, moveInDate: moveIn, notes: 'Assigned from Units page.' },
      });
      await tx.apartment.update({ where: { id: apartmentId }, data: { availability: 'OCCUPIED' } });

      if (previous && previous.apartmentId !== apartmentId) {
        const remaining = await tx.assignedApartment.count({ where: { apartmentId: previous.apartmentId } });
        if (remaining === 0) {
          await tx.apartment.update({ where: { id: previous.apartmentId }, data: { availability: 'AVAILABLE' } });
        }
      }
    });

    return this.listApartments();
  }

  /** Remove a resident from a unit; the unit becomes AVAILABLE when the last one leaves. */
  async unassignResident(apartmentId: string, userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException('Choose a resident to remove.');
    }
    const assignment = await this.prisma.assignedApartment.findUnique({ where: { userId } });
    if (!assignment || assignment.apartmentId !== apartmentId) {
      throw new BadRequestException('That resident is not assigned to this unit.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.assignedApartment.delete({ where: { userId } });
      const remaining = await tx.assignedApartment.count({ where: { apartmentId } });
      if (remaining === 0) {
        await tx.apartment.update({ where: { id: apartmentId }, data: { availability: 'AVAILABLE' } });
      }
    });

    return this.listApartments();
  }

  private toCents(value?: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  private toCount(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
  }

  private async requireApplication(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    return application;
  }

  private defaultMembershipDates() {
    const startingDate = new Date();
    const dueDate = new Date(startingDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    const finishDate = new Date(startingDate);
    finishDate.setFullYear(finishDate.getFullYear() + 1);

    return { startingDate, dueDate, finishDate };
  }

  private startOfWeek(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
  }

  private buildIncomeSummary(
    payments: Array<{ amountCents: number; currency: string; paidAt: Date | null }>,
    periods: { weekStart: Date; monthStart: Date; yearStart: Date },
  ) {
    const usdPayments = payments.filter((payment) => payment.currency === 'USD' && payment.paidAt);
    const sumSince = (start: Date) =>
      usdPayments
        .filter((payment) => payment.paidAt && payment.paidAt >= start)
        .reduce((sum, payment) => sum + payment.amountCents, 0);

    return {
      currency: 'USD',
      weekCents: sumSince(periods.weekStart),
      monthCents: sumSince(periods.monthStart),
      yearCents: sumSince(periods.yearStart),
      allTimeCents: usdPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
      paidPaymentCount: usdPayments.length,
    };
  }

  private parseJsonArray(value: string) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
