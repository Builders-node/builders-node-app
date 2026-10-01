/**
 * ca.buildersnode.com — a marketing site of its own, served from this same
 * build and this same Vercel project.
 *
 * It shares nothing with the main app's routing on purpose. The two are split
 * at the root (see main.tsx), so this site can have entirely its own pages and
 * its own sections without a single condition inside App.tsx — and nothing
 * added here can break the member app or the admin panel.
 *
 * What it deliberately does NOT host: applying, signing up, the member area.
 * Those stay on the apex domain. localStorage is per-origin, so a session
 * started here would be invisible over there, and one person would end up with
 * two accounts and two half-finished funnels.
 */

/** The host this site answers on. */
const CA_HOST = 'ca.buildersnode.com';

/**
 * The same site, locally. `*.localhost` resolves to 127.0.0.1 without any
 * /etc/hosts entry, so `http://ca.localhost:5173` browses the subdomain on the
 * host shape it really uses — links and all — rather than through a query
 * string that every internal link would have to carry.
 */
const CA_DEV_HOST = 'ca.localhost';

/**
 * Where the real product lives. Every call to action here points at it.
 *
 * Overridable so the site can be worked on locally against a dev server —
 * without it, every button on localhost would jump to production.
 */
const MAIN_SITE_URL = (import.meta.env.VITE_MAIN_SITE_URL ?? 'https://buildersnode.com').replace(/\/+$/, '');

/**
 * True when this document is being served as the CA site.
 *
 * Also matches a `?site=ca` query, which is the only practical way to open it
 * on localhost or on a Vercel preview URL — neither of which can carry the real
 * hostname. Read once, at boot, before anything rewrites the address bar.
 */
export function isCaSite(): boolean {
  const { hostname, search } = window.location;
  if (hostname === CA_HOST || hostname === CA_DEV_HOST) return true;
  // Never on the apex domain, whatever the query string says: a `?site=ca` link
  // posted somewhere must not be able to replace the real homepage.
  if (hostname === 'buildersnode.com' || hostname === 'www.buildersnode.com') return false;
  return new URLSearchParams(search).get('site') === 'ca';
}

/** An absolute URL on the main site. `mainSiteUrl('/apply')`. */
export function mainSiteUrl(path = '/'): string {
  return `${MAIN_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Where "Apply" sends people.
 *
 * `?src=ca` is the same marketing-link code the apply form already reads, so
 * applications that started here land in Admin → Settings → Traffic alongside
 * every other channel. It only counts once a link with the code `ca` exists
 * there — an unknown code is dropped rather than inventing a row.
 */
export function applyUrl(): string {
  return mainSiteUrl('/apply?src=ca');
}

/**
 * Which landing asked for the guide. Must match the server's allowlist in
 * `guide/guide.service.ts` — anything it doesn't recognise is stored as null,
 * so a typo here silently loses the attribution rather than failing loudly.
 */
export const GUIDE_SOURCE = 'ca';

/**
 * An internal link on this site.
 *
 * Carries `?site=ca` onward when that is how the site was selected — which is
 * the only way to reach it on a Vercel preview URL, where no hostname can say
 * it. On the real subdomain, and on `ca.localhost`, the host already decides
 * and the parameter never appears.
 */
export function caHref(path: string): string {
  const selectedByQuery = new URLSearchParams(window.location.search).get('site') === 'ca';
  return selectedByQuery ? `${path}${path.includes('?') ? '&' : '?'}site=ca` : path;
}

export type CaPageId = 'landing' | 'guide';

/**
 * Paths this site answers on.
 *
 * Adding a page is two lines here plus the component — that is the whole
 * routing story, and it is why more pages on this subdomain cost almost
 * nothing.
 */
export const CA_PATHS: Record<CaPageId, string> = {
  landing: '/',
  guide: '/guide',
};

const CA_PATH_TO_PAGE: Record<string, CaPageId> = {
  '/': 'landing',
  '/guide': 'guide',
};

/** Per-page browser titles. */
export const CA_TITLES: Record<CaPageId, string> = {
  landing: 'Builders Node — Startup Society in Próspera',
  guide: 'The private guide — Builders Node',
};

/** The page for a pathname, or null when nothing matches (→ the landing). */
export function caPageForPath(pathname: string): CaPageId | null {
  // Trailing slashes are the same page; '/pricing' and '/pricing/' must not be
  // two different answers.
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return CA_PATH_TO_PAGE[normalized || '/'] ?? null;
}
