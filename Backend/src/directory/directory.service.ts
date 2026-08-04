import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Links a member can attach to their directory profile. */
export type ProfileLinks = {
  website?: string;
  twitter?: string;
  linkedin?: string;
  github?: string;
};

export type DirectoryProfileInput = {
  directoryOptIn?: boolean;
  headline?: string;
  bio?: string;
  skills?: string[];
  links?: ProfileLinks;
};

const MAX_SKILLS = 12;
const MAX_SKILL_LENGTH = 32;
const MAX_HEADLINE = 120;
const MAX_BIO = 600;

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseLinks(raw: string | null | undefined): ProfileLinks {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const source = parsed as Record<string, unknown>;
    const out: ProfileLinks = {};
    for (const key of ['website', 'twitter', 'linkedin', 'github'] as const) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Trim, drop empties, dedupe case-insensitively, and cap length + count. */
function normalizeSkills(skills: string[] | undefined): string[] {
  if (!Array.isArray(skills)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const value = String(raw ?? '').trim().slice(0, MAX_SKILL_LENGTH);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

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
        avatarUrl: profile.avatarUrl,
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
      avatarUrl: profile.avatarUrl,
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
      avatarUrl: profile?.avatarUrl ?? null,
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
    if (input.links !== undefined) {
      const links: ProfileLinks = {};
      for (const key of ['website', 'twitter', 'linkedin', 'github'] as const) {
        const value = input.links?.[key];
        if (typeof value === 'string' && value.trim()) links[key] = value.trim().slice(0, 200);
      }
      data.linksJson = JSON.stringify(links);
    }

    // The row may not exist yet for a member who never edited their profile.
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.getMine(userId);
  }
}
