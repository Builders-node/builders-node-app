import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { purgeUser } from './purge-user';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        referralCode: true,
        role: true,
        mustChangePassword: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        membership: true,
        communityPlans: { orderBy: { purchasedAt: 'desc' } },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    return user;
  }

  async findReferrals(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    // How many people applied using this member's referral link.
    const referredCount = await this.prisma.application.count({
      where: { referredByUserId: userId },
    });
    return { referralCode: user.referralCode, referredCount };
  }

  async updateProfile(userId: string, data: { fullName?: string; phone?: string; location?: string }) {
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  /**
   * GDPR data portability: everything we hold about the user as one JSON object.
   * Excludes secrets (password hash, raw tokens) and the base64 proof blob (its
   * metadata is included; the file itself is downloadable via the proof endpoint).
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        referralCode: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        membership: true,
        communityPlans: true,
        payments: true,
        supportTickets: true,
        rentalRequests: true,
        assignedApartment: true,
        residencyApplication: {
          select: { status: true, proofFileName: true, proofFileType: true, submittedAt: true, reviewedAt: true, reviewNote: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const referrals = await this.prisma.application.count({ where: { referredByUserId: userId } });
    return { exportedAt: new Date().toISOString(), account: user, referralsMade: referrals };
  }

  /** GDPR right to erasure: a member deletes their own account and all owned data. */
  async deleteOwnAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    await this.prisma.$transaction((tx) => purgeUser(tx as PrismaService, userId));
    return { deleted: true, id: userId };
  }
}
