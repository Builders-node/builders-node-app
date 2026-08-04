/**
 * Carrying a referral code from the invite link to the application.
 *
 * The link is `https://buildersnode.com/?ref=BUILDERS-AB12CD`, but the code
 * can't just be read off the URL when the form renders: someone lands on the
 * landing page, scrolls it, then clicks Apply — and the URL-sync effect rewrites
 * the address to a bare `/apply`, taking the query with it. So the code is
 * captured once on boot and kept until an application is actually sent.
 */

const STORAGE_KEY = 'terminus_referral';

/**
 * Long enough to survive reading the landing page, sleeping on it, and coming
 * back a few weeks later. Not indefinite: on a shared laptop a stale code
 * shouldn't quietly credit the wrong member months afterwards.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { code: string; savedAt: number };

/**
 * Codes look like `BUILDERS-AB12CD`. Anything wilder than that came from a
 * hand-edited URL, and storing it would only put junk in an admin's face later.
 */
function normalize(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!code || code.length > 40) return null;
  return /^[A-Z0-9-]+$/.test(code) ? code : null;
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { code, savedAt } = parsed as Partial<Stored>;
    if (typeof code !== 'string' || typeof savedAt !== 'number') return null;
    return { code, savedAt };
  } catch {
    return null;
  }
}

/**
 * Read `?ref` off the current URL and remember it. Call once on boot, before
 * anything rewrites the address bar.
 *
 * A fresh `?ref` always wins over a stored one — following a second person's
 * link is a clear signal about who actually referred you.
 */
export function captureReferralFromUrl(): void {
  const fromUrl = normalize(new URLSearchParams(window.location.search).get('ref'));
  if (!fromUrl) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: fromUrl, savedAt: Date.now() } satisfies Stored));
  } catch {
    /* private mode / storage full — the field just stays empty */
  }
}

/** The remembered code, or '' if there isn't a live one. */
export function storedReferralCode(): string {
  const stored = read();
  if (!stored) return '';
  if (Date.now() - stored.savedAt > TTL_MS) {
    clearStoredReferral();
    return '';
  }
  return stored.code;
}

/**
 * Forget it. Called once an application is in — the next person to use this
 * browser is not the referrer's recruit.
 */
export function clearStoredReferral(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
