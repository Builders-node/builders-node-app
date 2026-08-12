import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { buildCredentialInvitation } from '../auth/invitation';
import { createTemporaryPassword } from '../auth/temporary-password';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { linksFromUrls, MAX_BIO } from '../common/profile-fields';
import { parseMoveInDate } from './move-in-date';
import { createReferralCode } from '../users/referral-code';
import { ApplyDto, ConfirmApplicationDto, CreateAccountDto, SendCredentialsDto } from './dto';

const CODE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_CODE_ATTEMPTS = 5;

/**
 * How long the password step stays open after the code is confirmed.
 *
 * Generous, because it covers a real person picking a password on a page they
 * may have left open — but finite, so an abandoned application doesn't leave a
 * standing key to the account lying around.
 */
const SETUP_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * The profile fields an application can seed.
 *
 * Everything here is a starting point, not a lock: the member edits all of it
 * on /profile afterwards. Nothing is directory-visible until they opt in.
 */
function profileSeedFrom(application: { fullName: string; phone?: string | null; about?: string | null; socialLinksJson?: string | null }) {
  return {
    fullName: application.fullName,
    phone: application.phone ?? undefined,
    bio: application.about ?? undefined,
    linksJson: application.socialLinksJson ?? undefined,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Step 1 of applying: email a 6-digit confirmation code and stash the pending
   * application. The real Application row is NOT created until the code is
   * confirmed, so unverified emails never enter the funnel.
   */
  async requestCode(dto: ApplyDto) {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.application.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new BadRequestException('An application with this email already exists.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    // Store the whole apply payload so confirm can build the Application from it.
    const payloadJson = JSON.stringify({ ...dto, email });

    await this.prisma.applicationVerification.upsert({
      where: { email },
      create: { email, code, payloadJson, expiresAt, attempts: 0 },
      update: { code, payloadJson, expiresAt, attempts: 0 },
    });

    await this.mail.sendApplicationCode(email, code);
    return { sent: true, email };
  }

  /**
   * Step 2: verify the code, then create the Application from the stored payload.
   */
  async confirmCode(dto: ConfirmApplicationDto) {
    const email = dto.email.toLowerCase();
    const pending = await this.prisma.applicationVerification.findUnique({ where: { email } });
    if (!pending) {
      throw new BadRequestException('No pending application for this email. Please submit the form again.');
    }

    if (pending.expiresAt < new Date()) {
      await this.prisma.applicationVerification.delete({ where: { email } });
      throw new BadRequestException('This code has expired. Please submit the form again to get a new one.');
    }

    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      await this.prisma.applicationVerification.delete({ where: { email } });
      throw new BadRequestException('Too many incorrect attempts. Please submit the form again.');
    }

    if (pending.code !== dto.code.trim()) {
      await this.prisma.applicationVerification.update({ where: { email }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('That code is not correct. Please check your email and try again.');
    }

    const payload = JSON.parse(pending.payloadJson) as ApplyDto;
    const application = await this.apply(payload);
    await this.prisma.applicationVerification.delete({ where: { email } });

    // Confirm receipt here rather than after the password step: this fires once
    // per application and covers both endings — applicants without an account go
    // on to set a password, applicants who already have one finish right here
    // and would otherwise have heard nothing at all.
    await this.mail.sendApplicationReceived(application.email, application.fullName);

    // If they don't have a login yet, the frontend will prompt them to set a
    // password (create-account below). If an account already exists, skip that.
    const accountExists = Boolean(await this.prisma.user.findUnique({ where: { email }, select: { id: true } }));

    // Entering the emailed code is the only thing that proves this is their
    // address, and it happens here. Hand back a one-time token so the password
    // step can prove it too — otherwise create-account has nothing to go on but
    // the email itself, and anyone who knows it can claim the account.
    let setupToken: string | null = null;
    if (!accountExists) {
      setupToken = randomUUID();
      await this.prisma.application.update({
        where: { id: application.id },
        data: { setupToken, setupTokenExpiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS) },
      });
    }

    return { confirmed: true, applicationId: application.id, accountExists, setupToken };
  }

  /**
   * Finishes apply by creating the applicant's login.
   *
   * The setup token is the whole authorisation here. It used to be enough to
   * name an email that had applied and had no account yet — so anyone who knew
   * (or guessed) an applicant's address could set a password, get signed in as
   * them, and inherit everything they typed into the form. The token is minted
   * only when the emailed code is entered, so possessing it means possessing
   * the mailbox.
   *
   * Looked up BY the token rather than by the email: that way the email in the
   * request can't select a different application than the token belongs to.
   */
  async createAccountFromApply(dto: CreateAccountDto) {
    const email = dto.email.toLowerCase();
    const token = dto.setupToken?.trim();
    if (!token) {
      throw new BadRequestException('This password link is no longer valid. Please apply again to get a new code.');
    }

    const application = await this.prisma.application.findUnique({ where: { setupToken: token } });
    if (!application || application.email !== email) {
      throw new BadRequestException('This password link is no longer valid. Please apply again to get a new code.');
    }
    if (!application.setupTokenExpiresAt || application.setupTokenExpiresAt < new Date()) {
      throw new BadRequestException('This password link has expired. Please apply again to get a new code.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new BadRequestException('An account already exists for this email. Please log in instead.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        referralCode: createReferralCode(),
        emailVerifiedAt: new Date(), // verified via the apply code they just entered
        // Carry the application over so the new member's profile isn't a blank
        // form asking for what they just typed on the way in.
        profile: { create: profileSeedFrom(application) },
        membership: { create: { status: 'APPLICANT' } },
      },
    });

    // One use only. The account now exists, so the check above would refuse a
    // replay anyway — but leaving a live token on the row would mean a spent
    // key sitting in the database for no reason.
    await this.prisma.application.update({
      where: { id: application.id },
      data: { setupToken: null, setupTokenExpiresAt: null },
    });

    await this.notifications.notify(user.id, {
      type: 'success',
      title: 'Welcome to Builders Node 🎉',
      body: 'Your account is ready. Complete your profile and connect Discord to get started.',
      link: '/account',
    });

    // Sign them straight in — mirrors the shape returned by /auth/signup & /auth/login.
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email, role: user.role }),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async apply(dto: ApplyDto) {
    const referralCode = this.normalizeReferralCode(dto.referralCode);
    const referrer = referralCode
      ? await this.prisma.user.findUnique({
          where: { referralCode },
          select: { id: true, referralCode: true },
        })
      : null;

    const links = linksFromUrls(dto.socials);
    const application = await this.prisma.application.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        note: dto.note,
        about: dto.about?.trim().slice(0, MAX_BIO) || null,
        moveInDate: parseMoveInDate(dto.moveInDate),
        socialLinksJson: Object.keys(links).length > 0 ? JSON.stringify(links) : null,
        referralCode,
        referredByUserId: referrer?.id,
        status: 'SUBMITTED',
      },
    });

    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'New application',
      body: `${application.fullName} (${application.email}) applied.`,
      link: '/admin',
    });

    return application;
  }

  async approveAndSendCredentials(dto: SendCredentialsDto) {
    const application = await this.prisma.application.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    const temporaryPassword = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await this.prisma.user.upsert({
      where: { email: application.email },
      create: {
        email: application.email,
        passwordHash,
        referralCode: createReferralCode(),
        mustChangePassword: true,
        profile: { create: profileSeedFrom(application) },
        membership: { create: { status: 'APPROVED', approvedAt: new Date() } },
      },
      update: {
        passwordHash,
        mustChangePassword: true,
        profile: {
          upsert: {
            create: profileSeedFrom(application),
            // Only name and phone are refreshed on an existing profile. Bio and
            // links are the member's to maintain once they have an account —
            // re-seeding here would overwrite their edits with the application
            // they wrote months ago.
            update: { fullName: application.fullName, phone: application.phone },
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
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    const invitation = buildCredentialInvitation({
      email: userWithReferral.email,
      token,
      temporaryPassword,
      frontendUrl: this.mail.frontendBaseUrl(),
    });
    await this.mail.sendInvitation(invitation);

    return { userId: userWithReferral.id, invitation };
  }

  private normalizeReferralCode(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.toUpperCase() : undefined;
  }
}
