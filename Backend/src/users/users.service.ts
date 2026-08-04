import { Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import {
  avatarUrlFor,
  MAX_AVATAR_BASE64_LENGTH,
  MAX_BIO,
  MAX_HEADLINE,
  normalizeLinks,
  normalizeSkills,
  parseJsonArray,
  parseLinks,
  type ProfileLinks,
} from '../common/profile-fields';
import { PrismaService } from '../database/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { purgeUser } from './purge-user';

/** Everything the unified profile page can write. All fields optional. */
export type ProfileUpdateInput = {
  fullName?: string;
  phone?: string;
  location?: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  links?: ProfileLinks;
  directoryOptIn?: boolean;
  avatarBase64?: string | null;
  avatarFileType?: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discord: DiscordService,
  ) {}

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
        discordId: true,
        discordUsername: true,
        createdAt: true,
        updatedAt: true,
        // Explicit select: `profile: true` would drag the base64 avatar into
        // every profile response.
        profile: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            location: true,
            avatarUrl: true,
            avatarData: true, // stripped below — only used to build the data URL
            avatarFileType: true,
            headline: true,
            bio: true,
            skillsJson: true,
            linksJson: true,
            directoryOptIn: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        membership: true,
        communityPlans: { orderBy: { purchasedAt: 'desc' } },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    // Present the profile in the shape the client works in: parsed skills and
    // links, an avatar URL rather than a blob.
    const { avatarData, skillsJson, linksJson, ...profileRest } = user.profile ?? {};
    const profile = user.profile
      ? {
          ...profileRest,
          avatarUrl: avatarUrlFor({ avatarData, avatarFileType: user.profile.avatarFileType, avatarUrl: user.profile.avatarUrl }),
          skills: parseJsonArray(skillsJson),
          links: parseLinks(linksJson),
        }
      : null;

    // Whether the server has Discord configured (drives the "Connect Discord" UI).
    return { ...user, profile, discordEnabled: this.discord.isEnabled() };
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

  /**
   * The single write path for everything on the profile page — the private
   * fields (name, phone, location), the directory-visible ones (headline, bio,
   * skills, links), the listing toggle, and the avatar.
   *
   * Every field is optional and only touched when present, so a partial save
   * from one section can't blank out another.
   */
  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const data: Record<string, unknown> = {};

    if (input.fullName !== undefined) data.fullName = input.fullName.trim() || null;
    if (input.phone !== undefined) data.phone = input.phone.trim() || null;
    if (input.location !== undefined) data.location = input.location.trim() || null;

    if (input.headline !== undefined) data.headline = input.headline.trim().slice(0, MAX_HEADLINE) || null;
    if (input.bio !== undefined) data.bio = input.bio.trim().slice(0, MAX_BIO) || null;
    if (input.skills !== undefined) data.skillsJson = JSON.stringify(normalizeSkills(input.skills));
    if (input.links !== undefined) data.linksJson = JSON.stringify(normalizeLinks(input.links));
    if (input.directoryOptIn !== undefined) data.directoryOptIn = Boolean(input.directoryOptIn);

    if (input.avatarBase64 !== undefined) {
      if (input.avatarBase64 === null || input.avatarBase64 === '') {
        data.avatarData = null;
        data.avatarFileType = null;
      } else {
        // Accept a data: URL or a bare base64 payload.
        const payload = input.avatarBase64.split(',').pop() ?? '';
        if (payload.length > MAX_AVATAR_BASE64_LENGTH) {
          throw new PayloadTooLargeException('That image is too large (max ~2.5 MB).');
        }
        data.avatarData = payload;
        data.avatarFileType = input.avatarFileType ?? 'image/jpeg';
      }
    }

    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.findProfile(userId);
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
