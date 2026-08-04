/**
 * Shared normalisation for the directory-visible half of a member's profile.
 *
 * Two endpoints write these columns — the unified profile page
 * (PATCH /users/:id/profile) and the older directory-specific route — so the
 * rules live here rather than being duplicated and drifting apart.
 */

export type ProfileLinks = {
  website?: string;
  twitter?: string;
  linkedin?: string;
  github?: string;
};

export const LINK_KEYS = ['website', 'twitter', 'linkedin', 'github'] as const;

export const MAX_SKILLS = 12;
export const MAX_SKILL_LENGTH = 32;
export const MAX_HEADLINE = 120;
export const MAX_BIO = 600;
/** ~2.5 MB decoded — an avatar has no business being bigger. */
export const MAX_AVATAR_BASE64_LENGTH = 3_500_000;

export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function parseLinks(raw: string | null | undefined): ProfileLinks {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const source = parsed as Record<string, unknown>;
    const out: ProfileLinks = {};
    for (const key of LINK_KEYS) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Trim, drop empties, dedupe case-insensitively, cap length and count. */
export function normalizeSkills(skills: unknown): string[] {
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

/** Keep only the four known link keys, so arbitrary values can't be stored. */
export function normalizeLinks(links: unknown): ProfileLinks {
  const out: ProfileLinks = {};
  if (!links || typeof links !== 'object') return out;
  const source = links as Record<string, unknown>;
  for (const key of LINK_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 200);
  }
  return out;
}

/**
 * The avatar is exposed as something an <img src> can use directly.
 *
 * Deliberately a `data:` URL rather than a separate endpoint: an <img> tag
 * can't send the Authorization header, and the member routes are owner-scoped,
 * so a `/users/:id/avatar` route would 403 the moment one member tried to see
 * another's photo in the directory. Inlining sidesteps both problems.
 *
 * That's only reasonable because the client downsizes avatars to 256px JPEG
 * (~20 KB) before upload — see resizeToAvatar() on the profile page.
 */
export function avatarUrlFor(
  profile: { avatarData?: string | null; avatarFileType?: string | null; avatarUrl?: string | null } | null | undefined,
): string | null {
  if (profile?.avatarData) {
    return `data:${profile.avatarFileType ?? 'image/jpeg'};base64,${profile.avatarData}`;
  }
  return profile?.avatarUrl ?? null;
}
