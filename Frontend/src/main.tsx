import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
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
        <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 93%)' }} aria-busy="true" />}>
          <CaSite />
        </Suspense>
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
