import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time, so the response time can't be used to find the key one
 * character at a time. Both sides are hashed first: timingSafeEqual needs equal
 * lengths, and comparing lengths directly would leak the key's length.
 */
export function isValidAdminAccessKey(providedKey: string | undefined, expectedKey: string | undefined): boolean {
  if (!providedKey || !expectedKey) {
    return false;
  }

  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(providedKey), digest(expectedKey));
}
