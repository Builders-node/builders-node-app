import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { buildCredentialInvitation } from '../auth/invitation';
import { createTemporaryPassword } from '../auth/temporary-password';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { createReferralCode } from '../users/referral-code';
import { ApplyDto, SendCredentialsDto } from './dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

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
