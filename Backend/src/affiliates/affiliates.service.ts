import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { buildCredentialInvitation } from '../auth/invitation';
import { createTemporaryPassword } from '../auth/temporary-password';
import { normalizeCode } from '../campaigns/campaigns.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createReferralCode } from '../users/referral-code';
import { ADMIN_ROLES } from '../users/roles';
import { AFFILIATE_KEY, parseAffiliateReward } from '../admin/global-settings';
import { AffiliateApplyDto } from './dto';

/** Generous, but not a place to paste a media kit. */
const MAX_NAME = 120;
const MAX_SHORT = 120;
const MAX_AUDIENCE = 300;
const MAX_ABOUT = 1500;
const MAX_LINKS = 5;
const MAX_LINK_LENGTH = 200;

export const AFFILIATE_STATUSES = ['PENDING', 'APPROVED', 'DECLINED'] as const;
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];

/**
 * The affiliate programme.
 *
 * An affiliate is paid a flat amount for each person who joins through them, so
 * the only thing that has to be tracked precisely is *who sent whom* — and that
 * already exists: applications carry `referredByUserId`, resolved from the
 * `?ref=` code on a member's link.
 *
 * That is why approving an affiliate creates them an account. It isn't a
 * membership and gives them no room: it is the row that owns a referral code,
 * which is the only thing their links can be built from. Without it an approved
 * affiliate would have nothing to share, and we would need a second, parallel
 * way of counting referrals that could only ever disagree with the first.
 */
@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Someone applying to promote Builders Node. Public and unauthenticated.
   *
   * Re-applying with the same address updates the pending application rather
   * than failing: people do resubmit after remembering a channel they forgot to
   * list, and "an application with this email already exists" is a dead end when
   * the fix they want is exactly that edit. Once a decision has been made the
   * row is frozen — a declined applicant cannot quietly reset themselves to
   * pending, and an approved one has nothing left to change here.
   */
  async apply(dto: AffiliateApplyDto) {
    const fullName = dto.fullName?.trim().slice(0, MAX_NAME) ?? '';
    if (!fullName) throw new BadRequestException('Please tell us your name.');

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.affiliateApplication.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== 'PENDING') {
      throw new BadRequestException(
        existing.status === 'APPROVED'
          ? 'You are already an affiliate — check your inbox for your link, or reset your password to sign in.'
          : 'We have already reviewed an application from this address. Reply to our email if something has changed.',
      );
    }

    const data = {
      fullName,
      telegram: trimTo(dto.telegram, MAX_SHORT),
      country: trimTo(dto.country, MAX_SHORT),
      audience: trimTo(dto.audience, MAX_AUDIENCE),
      audienceSize: trimTo(dto.audienceSize, MAX_SHORT),
      linksJson: serializeLinks(dto.links),
      about: trimTo(dto.about, MAX_ABOUT),
      // Only recorded when it matches a link an admin actually made, for the
      // same reason member applications check it: `?src=` is editable by anyone.
      campaignCode: await this.resolveCampaignCode(dto.campaignCode),
    };

    const application = existing
      ? await this.prisma.affiliateApplication.update({ where: { email }, data })
      : await this.prisma.affiliateApplication.create({ data: { ...data, email, status: 'PENDING' } });

    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'New affiliate application',
      body: `${application.fullName} (${application.email}) applied to the affiliate programme.`,
      link: '/admin/inbox/affiliates',
    });

    // Both of these are best-effort by design — see MailService.send, which
    // never throws. An applicant who got as far as a stored row should not be
    // shown a failure because our mail provider was having a bad minute.
    await this.mail.sendAffiliateApplicationReceived(application.email, application.fullName);
    await this.alertAdmins(application.fullName, application.email);

    return { submitted: true, email: application.email };
  }

  /** Every affiliate application, newest first. */
  async list(status?: string) {
    const filter = (status ?? '').toUpperCase();
    const where = AFFILIATE_STATUSES.includes(filter as AffiliateStatus) ? { status: filter } : {};
    const applications = await this.prisma.affiliateApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // How many people each approved affiliate has actually sent. One grouped
    // query rather than a count per row: this screen exists to compare them.
    const userIds = applications.map((row) => row.userId).filter((id): id is string => Boolean(id));
    const referralsByUser = new Map<string, number>();
    if (userIds.length > 0) {
      const grouped = await this.prisma.application.groupBy({
        by: ['referredByUserId'],
        where: { referredByUserId: { in: userIds } },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (row.referredByUserId) referralsByUser.set(row.referredByUserId, row._count._all);
      }
    }

    const codes = await this.referralCodesFor(userIds);
    const baseUrl = this.mail.frontendBaseUrl();

    return applications.map((row) => {
      const code = row.userId ? codes.get(row.userId) ?? null : null;
      return {
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        telegram: row.telegram,
        country: row.country,
        audience: row.audience,
        audienceSize: row.audienceSize,
        links: parseStoredLinks(row.linksJson),
        about: row.about,
        status: row.status,
        adminNote: row.adminNote,
        campaignCode: row.campaignCode,
        referralCode: code,
        inviteLink: code ? `${baseUrl}/?ref=${code}` : null,
        referredCount: row.userId ? referralsByUser.get(row.userId) ?? 0 : 0,
        reviewedAt: row.reviewedAt,
        createdAt: row.createdAt,
      };
    });
  }

  /** Pending applications — the Inbox badge. */
  pendingCount() {
    return this.prisma.affiliateApplication.count({ where: { status: 'PENDING' } });
  }

  /**
   * Approve: give them the account their referral code hangs off, and mail them
   * the link plus a way in.
   *
   * Approving twice is a no-op rather than an error — the second press must not
   * mint a new temporary password over an account they have already set up.
   */
  async approve(id: string, adminNote?: string) {
    const application = await this.requireApplication(id);
    if (application.status === 'APPROVED') {
      throw new BadRequestException('This affiliate is already approved.');
    }

    const reward = await this.reward();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: application.email },
      select: { id: true, referralCode: true },
    });

    // Somebody who already has a login — a member, or an admin — keeps it. They
    // already have a referral code and a password they chose, and replacing
    // either to "onboard" them as an affiliate would lock them out of the
    // account they use.
    const user = existingUser
      ? await this.ensureReferralCode(existingUser)
      : await this.createAffiliateAccount(application.email, application.fullName, application.telegram);

    await this.prisma.affiliateApplication.update({
      where: { id },
      data: {
        status: 'APPROVED',
        userId: user.id,
        adminNote: adminNote?.trim() || application.adminNote,
        reviewedAt: new Date(),
      },
    });

    const inviteLink = `${this.mail.frontendBaseUrl()}/?ref=${user.referralCode}`;
    await this.mail.sendAffiliateApproved(application.email, application.fullName, {
      inviteLink,
      referralCode: user.referralCode as string,
      rewardCents: reward.rewardCents,
      currency: reward.currency,
      // Only sent when we just made the account. Someone who already had a
      // login gets the link and nothing else — their password is their own.
      setupUrl: user.setupUrl,
      temporaryPassword: user.temporaryPassword,
    });

    return this.list();
  }

  /** Decline. The note is for us; the email says only that it's a no for now. */
  async decline(id: string, adminNote?: string) {
    const application = await this.requireApplication(id);
    if (application.status === 'DECLINED') return this.list();

    await this.prisma.affiliateApplication.update({
      where: { id },
      data: { status: 'DECLINED', adminNote: adminNote?.trim() || application.adminNote, reviewedAt: new Date() },
    });
    await this.mail.sendAffiliateDeclined(application.email, application.fullName);
    return this.list();
  }

  async remove(id: string) {
    await this.requireApplication(id);
    await this.prisma.affiliateApplication.delete({ where: { id } });
    return this.list();
  }

  /** The current payout terms, as the public page and the emails quote them. */
  async reward() {
    const row = await this.prisma.globalSetting.findUnique({ where: { key: AFFILIATE_KEY } });
    return parseAffiliateReward(row?.value);
  }

  private async requireApplication(id: string) {
    const application = await this.prisma.affiliateApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Affiliate application not found.');
    return application;
  }

  /** A user row whose only job is owning a referral code, plus a way to sign in. */
  private async createAffiliateAccount(email: string, fullName: string, phone: string | null) {
    const temporaryPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        referralCode: createReferralCode(),
        mustChangePassword: true,
        // No membership record: an affiliate has not been approved to live
        // here, and inventing one would put them in the residents list.
        profile: { create: { fullName, phone: phone ?? undefined } },
      },
      select: { id: true, referralCode: true },
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

    return { ...user, setupUrl: invitation.setupUrl, temporaryPassword };
  }

  /**
   * Accounts made before referral codes existed have none, and an affiliate
   * link with `?ref=null` in it is worse than no link at all.
   */
  private async ensureReferralCode(user: { id: string; referralCode: string | null }) {
    const withCode = user.referralCode
      ? user
      : await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: createReferralCode() },
          select: { id: true, referralCode: true },
        });
    return { ...withCode, setupUrl: undefined as string | undefined, temporaryPassword: undefined as string | undefined };
  }

  private async referralCodesFor(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, referralCode: true },
    });
    return new Map(users.filter((user) => user.referralCode).map((user) => [user.id, user.referralCode as string]));
  }

  private async resolveCampaignCode(raw?: string): Promise<string | null> {
    const code = normalizeCode(raw);
    if (!code) return null;
    const link = await this.prisma.campaignLink.findUnique({ where: { code }, select: { code: true } });
    return link?.code ?? null;
  }

  /**
   * Mail the admins who would act on this.
   *
   * Their own addresses rather than a configured inbox: the people with the
   * role are exactly the people who can approve it, and one more env var to
   * forget is one more way for applications to pile up unread. The same list
   * the in-app notification goes to, so nobody gets the badge without the mail.
   */
  private async alertAdmins(fullName: string, email: string) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: { in: ADMIN_ROLES } },
        select: { email: true },
      });
      const link = `${this.mail.frontendBaseUrl()}/admin/inbox/affiliates`;
      await Promise.all(admins.map((admin) => this.mail.sendAffiliateApplicationAlert(admin.email, fullName, email, link)));
    } catch (error) {
      this.logger.warn(`Could not alert admins about an affiliate application: ${(error as Error).message}`);
    }
  }
}

function trimTo(value: string | undefined | null, max: number): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Affiliate links are kept as a plain list, not mapped onto the four profile
 * buckets: someone promoting on YouTube, TikTok and Instagram has three
 * channels that all read as "website", and only the first would survive.
 */
function serializeLinks(links: unknown): string | null {
  if (!Array.isArray(links)) return null;
  const cleaned: string[] = [];
  for (const raw of links) {
    const value = String(raw ?? '').trim().slice(0, MAX_LINK_LENGTH);
    if (!value) continue;
    try {
      new URL(value.startsWith('http') ? value : `https://${value}`);
    } catch {
      continue; // not a URL — drop it rather than store junk
    }
    if (!cleaned.includes(value)) cleaned.push(value);
    if (cleaned.length >= MAX_LINKS) break;
  }
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function parseStoredLinks(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
