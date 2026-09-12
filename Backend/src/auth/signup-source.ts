/**
 * Where a self-serve signup came from.
 *
 * One short slug, recorded on the user, so "who are our affiliates" has an
 * answer that doesn't depend on anyone filling in a form. The affiliate page's
 * only call to action is the signup button, and this is what makes that button
 * distinguishable from the one on the landing page afterwards.
 *
 * Deliberately an allowlist rather than free text: it arrives from the browser
 * on an unauthenticated endpoint, and it is read back into an admin screen.
 * Anything unrecognised is dropped, so the column never holds a value no part
 * of the app knows how to render.
 */
export const SIGNUP_SOURCES = ['affiliate-page'] as const;

export type SignupSource = (typeof SIGNUP_SOURCES)[number];

export function normalizeSignupSource(raw: string | undefined | null): SignupSource | null {
  const value = (raw ?? '').trim().toLowerCase();
  return (SIGNUP_SOURCES as readonly string[]).includes(value) ? (value as SignupSource) : null;
}
