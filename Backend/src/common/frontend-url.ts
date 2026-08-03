/**
 * FRONTEND_URL is a comma-separated allowlist (the custom domain plus any
 * preview/vercel origins) because it also feeds the CORS config. Anywhere we
 * build a user-facing link we want exactly one origin — the branded one.
 *
 * Prefers the first non-`*.vercel.app` entry so members always get
 * https://buildersnode.com/... rather than a preview URL, and never the raw
 * comma-separated string.
 */
export function resolveFrontendBaseUrl(raw: string | undefined, fallback = 'http://localhost:5173'): string {
  const urls = (raw ?? fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (urls.length === 0) return fallback.replace(/\/+$/, '');
  const preferred = urls.find((url) => !/\.vercel\.app(?:\/|$)/.test(url)) ?? urls[0];
  return preferred.replace(/\/+$/, '');
}
