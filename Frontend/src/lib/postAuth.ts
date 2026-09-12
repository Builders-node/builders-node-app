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

/**
 * Which page sent them to the signup form.
 *
 * Stored beside the destination and sent with the signup, so an account created
 * from the affiliate page can be told apart afterwards. The affiliate page has
 * no form any more — this is the only record of who arrived to promote us.
 */
const SOURCE_KEY = 'terminus_signup_source';

/** Only pages it makes sense to be dropped on straight after signing in. */
const ALLOWED: PageId[] = ['affiliateHub', 'profile', 'community', 'resources', 'myProfile'];

export function rememberPostAuthPage(page: PageId, source?: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, page);
    if (source) sessionStorage.setItem(SOURCE_KEY, source);
  } catch {
    /* private mode — the redirect just falls back to the default home */
  }
}

/**
 * The remembered source, for the signup request to carry.
 *
 * Read rather than taken: signing up can fail on a weak password or a taken
 * address, and clearing it on the first attempt would lose the attribution of
 * everyone who got it wrong once. It is cleared with the destination, on the
 * sign-in that actually succeeds.
 */
export function signupSource(): string | undefined {
  try {
    return sessionStorage.getItem(SOURCE_KEY) ?? undefined;
  } catch {
    return undefined;
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
    sessionStorage.removeItem(SOURCE_KEY);
    // Validated against the list rather than trusted: this value is writable by
    // anything running in the tab, and it decides where a fresh session lands.
    return stored && ALLOWED.includes(stored as PageId) ? (stored as PageId) : null;
  } catch {
    return null;
  }
}
