import { apiRequest } from './api';

/**
 * Carrying a marketing link's code from the click to the application.
 *
 * The link is `https://buildersnode.com/?src=twitter-launch`. Same problem the
 * referral code has: the address bar is rewritten on the first navigation, so
 * the code is captured once on boot and kept until an application is sent.
 *
 * Separate from the referral code on purpose. That one credits a member who
 * invited someone; this one credits a channel we posted on, and a person can
 * easily arrive through both.
 */

const STORAGE_KEY = 'terminus_campaign';
const VISITOR_KEY = 'terminus_visitor';

/** Long enough to read the page, sleep on it, and come back. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { code: string; savedAt: number };

/** Codes are lowercase, url-safe and short; anything else was hand-edited. */
function normalize(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (!code || code.length > 40) return null;
  return /^[a-z0-9][a-z0-9-]*$/.test(code) ? code : null;
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
 * A random id this browser makes up for itself, so ten visits by one person
 * don't read as ten people.
 *
 * Not derived from anything about the visitor — no address, no fingerprint. It
 * means nothing outside this browser and disappears when they clear it, which
 * is the point: the report needs to separate people, not identify them.
 */
function visitorKey(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    // Private mode: still send something, so the visit counts as a view even
    // though it can't be told apart from another.
    return 'anonymous';
  }
}

/**
 * Read `?src` off the current URL, remember it, and count the arrival. Call
 * once on boot, before anything rewrites the address bar.
 *
 * A fresh `?src` always wins over a stored one: the last link they actually
 * clicked is the one that brought them back.
 */
export function captureCampaignFromUrl(): void {
  const fromUrl = normalize(new URLSearchParams(window.location.search).get('src'));
  if (!fromUrl) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: fromUrl, savedAt: Date.now() } satisfies Stored));
  } catch {
    /* private mode — the visit is still counted, it just won't reach the form */
  }

  // Fire and forget. This runs during first paint and must never delay it or
  // surface an error: an unreachable API means one uncounted view, nothing more.
  void apiRequest(`/public/campaigns/${encodeURIComponent(fromUrl)}/visit`, {
    method: 'POST',
    body: JSON.stringify({ visitorKey: visitorKey() }),
  }).catch(() => {
    /* not worth telling anyone about */
  });
}

/** The remembered code, or '' if there isn't a live one. */
export function storedCampaignCode(): string {
  const stored = read();
  if (!stored) return '';
  if (Date.now() - stored.savedAt > TTL_MS) {
    clearStoredCampaign();
    return '';
  }
  return stored.code;
}

/** Forget it — called once an application is in. */
export function clearStoredCampaign(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
