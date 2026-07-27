import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
}
