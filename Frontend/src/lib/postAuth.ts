import type { PageId } from '../data/dashboard';

/**
 * Where to land once a session starts.
 *
 * Signing in normally means "take me home" — the member dashboard, or the admin
 * panel. But someone who pressed "Create account" on the affiliate page came for
 * one specific thing, and dropping them on the generic home leaves them hunting
 * through the sidebar for the link they signed up to get.
 *
 * Kept in sessionStorage rather than in React state because the auth screens
 * replace the page that set it, and Google sign-in leaves and re-enters the tab
 * entirely. Read once and cleared, so a stale intent can never redirect a later,
 * unrelated login.
 */
const STORAGE_KEY = 'terminus_post_auth';

/** Only pages it makes sense to be dropped on straight after signing in. */
const ALLOWED: PageId[] = ['affiliateHub', 'profile', 'community', 'resources', 'myProfile'];

export function rememberPostAuthPage(page: PageId): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, page);
  } catch {
    /* private mode — the redirect just falls back to the default home */
  }
}

/**
 * The remembered page, if there is one. Clears it on the way out: an intent is
 * spent by the sign-in it was set for.
 */
export function takePostAuthPage(): PageId | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    // Validated against the list rather than trusted: this value is writable by
    // anything running in the tab, and it decides where a fresh session lands.
    return stored && ALLOWED.includes(stored as PageId) ? (stored as PageId) : null;
  } catch {
    return null;
  }
}
