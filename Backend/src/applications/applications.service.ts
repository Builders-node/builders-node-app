import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { buildCredentialInvitation } from '../auth/invitation';
import { createTemporaryPassword } from '../auth/temporary-password';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { createReferralCode } from '../users/referral-code';
import { ApplyDto, ConfirmApplicationDto, SendCredentialsDto } from './dto';

const CODE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
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
    return { confirmed: true, applicationId: application.id };
  }

  async apply(dto: ApplyDto) {
    const referralCode = this.normalizeReferralCode(dto.referralCode);
    const referrer = referralCode
      ? await this.prisma.user.findUnique({
          where: { referralCode },
          select: { id: true, referralCode: true },
        })
      : null;

    return this.prisma.application.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        note: dto.note,
        referralCode,
        referredByUserId: referrer?.id,
        status: 'SUBMITTED',
      },
    });
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
        profile: {
          create: {
            fullName: application.fullName,
            phone: application.phone,
          },
        },
        membership: { create: { status: 'APPROVED', approvedAt: new Date() } },
      },
      update: {
        passwordHash,
        mustChangePassword: true,
        profile: {
          upsert: {
            create: { fullName: application.fullName, phone: application.phone },
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
