import { lazy, Suspense, useEffect, useState } from 'react';
import { CA_TITLES, caPageForPath, type CaPageId } from './site';

const CaLanding = lazy(() => import('./pages/CaLanding').then((m) => ({ default: m.CaLanding })));

/**
 * The whole of ca.buildersnode.com.
 *
 * Its own router, deliberately tiny. The main app's routing carries auth
 * guards, admin sub-pages, dynamic segments and a redirect for signed-in
 * visitors — none of which mean anything on a marketing site, and all of which
 * would have to be reasoned about on every change if the two shared a table.
 */
export function CaSite() {
  const [page, setPage] = useState<CaPageId>(() => caPageForPath(window.location.pathname) ?? 'landing');

  useEffect(() => {
    document.title = CA_TITLES[page];
  }, [page]);

  // Back/forward. Nothing here pushes history yet — a single page has nowhere
  // to go — but this is what makes the second page free to add.
  useEffect(() => {
    const onPopState = () => setPage(caPageForPath(window.location.pathname) ?? 'landing');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /**
   * Keep this host out of the index.
   *
   * The authoritative signal is the `X-Robots-Tag` header Vercel attaches for
   * this hostname (see vercel.json) — a header deindexes, where robots.txt only
   * stops crawling. This meta tag is the belt to that braces, and it also
   * covers a preview URL opened with `?site=ca`, which no host rule matches.
   *
   * The canonical link is rewritten too: index.html hard-codes the apex domain,
   * and pointing a noindex page at the homepage is a mixed signal.
   */
  useEffect(() => {
    // Rewrite index.html's own tag rather than appending a second one: two
    // conflicting robots metas resolve to the stricter of the pair, which
    // happens to be the answer we want but reads as a bug to anyone auditing
    // the page.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = meta?.content;
    if (meta) meta.content = 'noindex, nofollow';

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousCanonical = canonical?.href;
    if (canonical) canonical.href = window.location.origin + window.location.pathname;

    return () => {
      if (meta && previousRobots) meta.content = previousRobots;
      if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, []);

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 93%)' }} aria-busy="true" />}>
      {/* One page today. The second one turns this into a switch — `page` is
          already resolved from the URL and kept in sync with Back/forward. */}
      <CaLanding />
    </Suspense>
  );
}
