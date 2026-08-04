import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  avatarUrlFor,
  MAX_BIO,
  MAX_HEADLINE,
  normalizeLinks,
  normalizeSkills,
  parseJsonArray,
  parseLinks,
  type ProfileLinks,
} from '../common/profile-fields';

export type { ProfileLinks };
import { PrismaService } from '../database/prisma.service';

export type DirectoryProfileInput = {
  directoryOptIn?: boolean;
  headline?: string;
  bio?: string;
  skills?: string[];
  links?: ProfileLinks;
};

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The directory is members-only. Applicants and past members can't browse it,
   * so being listed never exposes anyone beyond the people they actually live
   * alongside.
   */
  private async requireActiveMember(userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (membership?.status !== 'ACTIVE_MEMBER') {
      throw new ForbiddenException('The member directory is available to active members.');
    }
  }

  /** Everyone who opted in and is still an active member. */
  async list(viewerId: string, query?: { search?: string; skill?: string }) {
    await this.requireActiveMember(viewerId);

    const profiles = await this.prisma.profile.findMany({
      where: {
        directoryOptIn: true,
        user: { membership: { status: 'ACTIVE_MEMBER' } },
      },
      select: {
        userId: true,
        fullName: true,
        location: true,
        avatarUrl: true,
        avatarData: true,
        avatarFileType: true,
        headline: true,
        skillsJson: true,
        user: { select: { membership: { select: { activatedAt: true } } } },
      },
    });

    const search = query?.search?.trim().toLowerCase();
    const skill = query?.skill?.trim().toLowerCase();

    const items = profiles
      .map((profile) => ({
        userId: profile.userId,
        fullName: profile.fullName ?? 'Member',
        location: profile.location,
        avatarUrl: avatarUrlFor(profile),
        headline: profile.headline,
        skills: parseJsonArray(profile.skillsJson),
        memberSince: profile.user.membership?.activatedAt ?? null,
        isSelf: profile.userId === viewerId,
      }))
      .filter((item) => {
        if (skill && !item.skills.some((s) => s.toLowerCase() === skill)) return false;
        if (!search) return true;
        const haystack = [item.fullName, item.headline ?? '', item.location ?? '', ...item.skills]
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    // Every skill in use, so the UI can offer real filter chips rather than a
    // hardcoded list.
    const skillCounts = new Map<string, number>();
    for (const item of items) {
      for (const s of item.skills) {
        const key = s.toLowerCase();
        skillCounts.set(key, (skillCounts.get(key) ?? 0) + 1);
      }
    }
    const skills = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    return { items, skills, total: items.length };
  }

  /** One member's public-to-members profile. */
  async detail(viewerId: string, userId: string) {
    await this.requireActiveMember(viewerId);

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        userId: true,
        fullName: true,
        location: true,
        avatarUrl: true,
        avatarData: true,
        avatarFileType: true,
        headline: true,
        bio: true,
        skillsJson: true,
        linksJson: true,
        directoryOptIn: true,
        user: {
          select: {
            email: true,
            discordUsername: true,
            membership: { select: { status: true, activatedAt: true } },
          },
        },
      },
    });

    // Same 404 whether the profile is missing, hidden, or belongs to someone
    // who left — browsing can't reveal who exists but chose not to be listed.
    if (!profile || !profile.directoryOptIn || profile.user.membership?.status !== 'ACTIVE_MEMBER') {
      throw new NotFoundException('This member is not in the directory.');
    }

    return {
      userId: profile.userId,
      fullName: profile.fullName ?? 'Member',
      location: profile.location,
      avatarUrl: avatarUrlFor(profile),
      headline: profile.headline,
      bio: profile.bio,
      skills: parseJsonArray(profile.skillsJson),
      links: parseLinks(profile.linksJson),
      discordUsername: profile.user.discordUsername,
      memberSince: profile.user.membership?.activatedAt ?? null,
      isSelf: profile.userId === viewerId,
    };
  }

  /** The member's own record — returned whether or not they've opted in. */
  async getMine(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        fullName: true,
        location: true,
        avatarUrl: true,
        avatarData: true,
        avatarFileType: true,
        headline: true,
        bio: true,
        skillsJson: true,
        linksJson: true,
        directoryOptIn: true,
      },
    });

    return {
      fullName: profile?.fullName ?? null,
      location: profile?.location ?? null,
      avatarUrl: avatarUrlFor(profile),
      headline: profile?.headline ?? null,
      bio: profile?.bio ?? null,
      skills: parseJsonArray(profile?.skillsJson),
      links: parseLinks(profile?.linksJson),
      directoryOptIn: profile?.directoryOptIn ?? false,
    };
  }

  async updateMine(userId: string, input: DirectoryProfileInput) {
    const data: {
      directoryOptIn?: boolean;
      headline?: string | null;
      bio?: string | null;
      skillsJson?: string;
      linksJson?: string;
    } = {};

    if (input.directoryOptIn !== undefined) data.directoryOptIn = Boolean(input.directoryOptIn);
    if (input.headline !== undefined) data.headline = input.headline.trim().slice(0, MAX_HEADLINE) || null;
    if (input.bio !== undefined) data.bio = input.bio.trim().slice(0, MAX_BIO) || null;
    if (input.skills !== undefined) data.skillsJson = JSON.stringify(normalizeSkills(input.skills));
    if (input.links !== undefined) data.linksJson = JSON.stringify(normalizeLinks(input.links));

    // The row may not exist yet for a member who never edited their profile.
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.getMine(userId);
  }
}
