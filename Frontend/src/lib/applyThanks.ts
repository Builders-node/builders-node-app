/**
 * The handoff from the apply form to /apply-thanks.
 *
 * The thank-you page is reached by a real document load, not an in-app
 * navigation — that is the whole point of it. A full reload is what makes GA4,
 * Clarity and the Meta Pixel each record a genuine pageview on a distinct URL,
 * which is what an "URL contains /apply-thanks" conversion goal in Google Ads or
 * Meta keys off. An SPA pushState is invisible to some of that.
 *
 * But a reload also throws away every piece of React state, so anything the
 * page needs has to survive the trip. That's what this is.
 *
 * sessionStorage rather than localStorage: this belongs to the tab that just
 * applied. A month later on the same laptop it should not still be there, and
 * a second tab has nothing to do with it.
 */

const STORAGE_KEY = 'terminus_apply_done';

/** The page is a redirect target, so it should be open seconds after the write. */
const TTL_MS = 10 * 60 * 1000;

export type ApplyThanksHandoff = {
  fullName: string;
  email: string;
};

type Stored = ApplyThanksHandoff & { savedAt: number };

/** Where the finished application sends people. */
export const APPLY_THANKS_PATH = '/apply-thanks';

/**
 * Finish the application: stash who it was, then leave by a real page load.
 *
 * `assign` rather than `replace` on purpose — Back should return to the form's
 * URL rather than skipping the whole apply step, and the form is safe to land
 * on again (the application already exists; re-submitting the same address is
 * refused by the server).
 */
export function goToApplyThanks(applicant: ApplyThanksHandoff): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...applicant, savedAt: Date.now() } satisfies Stored));
  } catch {
    // Private mode, or storage full. The redirect still has to happen — the
    // page just greets them generically instead of by name.
  }
  window.location.assign(APPLY_THANKS_PATH);
}

/**
 * Read the handoff, once.
 *
 * Cleared on read, so a refresh of the thank-you page shows the generic version
 * rather than congratulating somebody a second time. Anyone who opens the URL
 * without having just applied — a shared link, a bookmark, a crawler — gets
 * null, and the page is written to be honest in that case.
 */
export function takeApplyThanks(): ApplyThanksHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { fullName, email, savedAt } = parsed as Partial<Stored>;
    if (typeof savedAt !== 'number' || Date.now() - savedAt > TTL_MS) return null;
    return {
      fullName: typeof fullName === 'string' ? fullName : '',
      email: typeof email === 'string' ? email : '',
    };
  } catch {
    return null;
  }
}
