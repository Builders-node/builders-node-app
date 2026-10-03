import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { createReferralCode } from '../users/referral-code';
import { normalizeSignupSource } from './signup-source';
import { reclaimUnverifiedAccount, signSession } from './session';

/**
 * Compared against when an email has no account, so a miss costs the same
 * bcrypt work as a wrong password. Without it, how fast "incorrect" came back
 * said whether the address was registered. Made on first use rather than at
 * load: a cost-12 hash is a quarter of a second off every cold start.
 */
let dummyHash: Promise<string> | null = null;
const timingEqualiser = () => (dummyHash ??= bcrypt.hash('timing-equaliser', 12));
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
        signupSource: normalizeSignupSource(dto.source),
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

    return signSession(this.jwt, user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const matches = await bcrypt.compare(dto.password, user?.passwordHash ?? (await timingEqualiser()));
    if (!user || !matches) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    return signSession(this.jwt, user);
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
    if (existing && !existing.emailVerifiedAt) {
      // Google has just proven the address, and nothing had before: whoever
      // set this account's password may not be its owner. See
      // reclaimUnverifiedAccount.
      await reclaimUnverifiedAccount(this.prisma, existing.id);
      if (existing.mustChangePassword) {
        await this.prisma.user.update({ where: { id: existing.id }, data: { mustChangePassword: false } });
      }
      return signSession(this.jwt, { ...existing, sessionVersion: existing.sessionVersion + 1 });
    }
    if (existing) {
      // A pending password setup is settled too: `mustChangePassword` means
      // "we mailed them a temporary password and they're still on it", and
      // someone who just signed in with Google isn't. Left set, they keep
      // showing as "Setup required" in the admin list forever.
      if (existing.mustChangePassword) {
        await this.prisma.user.update({ where: { id: existing.id }, data: { mustChangePassword: false } });
      }
      return signSession(this.jwt, existing);
    }

    // No account yet — create one. Google users have no password, so store a
    // random hash; they can set a real password later via the reset flow.
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(randomUUID(), 12),
        referralCode: createReferralCode(),
        // Only on the branch that creates the account: someone signing in with
        // Google to an account they already have did not just sign up, and
        // stamping them here would rewrite how they originally arrived.
        signupSource: normalizeSignupSource(dto.source),
        emailVerifiedAt: new Date(),
        profile: { create: { fullName } },
        membership: { create: { status: 'APPLICANT' } },
      },
    });

    return signSession(this.jwt, user);
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

    // A reset is what someone does when they think somebody else may be in
    // their account: every existing login ends, and so does every other reset
    // link still sitting in their inbox.
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash: await bcrypt.hash(dto.password, 12),
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    });
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } });

    return { passwordReset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    // Every other device is signed out. This one gets a fresh session back so
    // the person who just changed it isn't thrown out with them.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 12),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
    });

    return { passwordChanged: true, ...signSession(this.jwt, updated) };
  }
}
