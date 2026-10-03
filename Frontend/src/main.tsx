import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isCaSite } from './sites/ca/site';
import { queryClient } from './lib/queryClient';
import { captureReferralFromUrl } from './lib/referral';
import { captureCampaignFromUrl } from './lib/campaign';
import './tailwind.css';
import './styles.css';

// Before React mounts — App's URL-sync effect rewrites the address to a bare
// path on the first navigation, and ?ref would be gone with it.
captureReferralFromUrl();
captureCampaignFromUrl();

/**
 * A deploy replaces every hashed chunk. A tab opened on the previous build then
 * asks for files that no longer exist — and since vercel.json no longer answers
 * /assets/ misses with index.html, the import fails cleanly. Vite reports that
 * here; one reload picks up the new build and its new chunk names.
 *
 * Guarded by a timestamp so a chunk that is genuinely broken can't trap the
 * visitor in a reload loop: a second failure inside the window falls through to
 * the ErrorBoundary's "Reload" screen instead.
 */
const PRELOAD_RELOAD_KEY = 'bn_preload_reload_at';
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY)) || 0;
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked means no loop guard — leave it to the ErrorBoundary
    // rather than risk reloading forever.
    return;
  }
  // Stop Vite rethrowing — the page is about to be replaced anyway.
  event.preventDefault();
  window.location.reload();
});

/**
 * ca.buildersnode.com is a separate marketing site served from this same build.
 *
 * Split at the root rather than inside App: the two share components and the
 * API client, but nothing of the routing, the session or the admin panel. Lazy
 * so the apex domain never downloads a page it cannot reach.
 */
const CaSite = lazy(() => import('./sites/ca/CaSite').then((m) => ({ default: m.CaSite })));
const site = isCaSite() ? 'ca' : 'main';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* At the root, not inside a page — the cache has to outlive navigation
        for any of it to be worth having. */}
    <QueryClientProvider client={queryClient}>
      {site === 'ca' ? (
        <ErrorBoundary>
          <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 93%)' }} aria-busy="true" />}>
            <CaSite />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
