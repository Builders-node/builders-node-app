import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { createReferralCode } from '../users/referral-code';
import { ChangePasswordDto, GoogleLoginDto, LoginDto, PasswordResetDto, PasswordResetRequestDto, SignUpDto } from './dto';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async signUp(dto: SignUpDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        referralCode: createReferralCode(),
        profile: { create: { fullName: dto.fullName } },
        membership: { create: { status: 'APPLICANT' } },
      },
    });

    const verification = await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });
    await this.mail.sendEmailVerification(user.email, verification.token);

    return this.issueSession(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    return this.issueSession(user.id, user.email, user.role);
  }

  async googleLogin(dto: GoogleLoginDto) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured on the server.');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken: dto.credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in could not be verified.');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account has no verified email.');
    }

    const email = payload.email.toLowerCase();
    const fullName = payload.name ?? payload.email.split('@')[0];

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Mark the email verified (Google vouches for it) and sign in.
      if (!existing.emailVerifiedAt) {
        await this.prisma.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
      }
      return this.issueSession(existing.id, existing.email, existing.role);
    }

    // No account yet — create one. Google users have no password, so store a
    // random hash; they can set a real password later via the reset flow.
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(randomUUID(), 12),
        referralCode: createReferralCode(),
        emailVerifiedAt: new Date(),
        profile: { create: { fullName } },
        membership: { create: { status: 'APPLICANT' } },
      },
    });

    return this.issueSession(user.id, user.email, user.role);
  }

  async verifyEmail(token: string) {
    const verification = await this.prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!verification || verification.expiresAt < new Date()) {
      throw new UnauthorizedException('Verification link is invalid or expired.');
    }

    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.prisma.emailVerificationToken.delete({ where: { token } });

    return { verified: true };
  }

  async requestPasswordReset(dto: PasswordResetRequestDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      return { resetRequested: true };
    }

    const reset = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    await this.mail.sendPasswordReset(user.email, reset.token);

    return { resetRequested: true };
  }

  async resetPassword(dto: PasswordResetDto) {
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { token: dto.token } });
    if (!reset || reset.expiresAt < new Date()) {
      throw new UnauthorizedException('Password reset link is invalid or expired.');
    }

    await this.prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash: await bcrypt.hash(dto.password, 12),
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
      },
    });
    await this.prisma.passwordResetToken.delete({ where: { token: dto.token } });

    return { passwordReset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 12),
        mustChangePassword: false,
      },
    });

    return { passwordChanged: true };
  }

  private async issueSession(userId: string, email: string, role?: string) {
    const resolvedRole = role ?? (await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role ?? 'MEMBER';

    return {
      accessToken: this.jwt.sign({ sub: userId, email, role: resolvedRole }),
      user: { id: userId, email, role: resolvedRole },
    };
  }
}
