import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import { captureReferralFromUrl } from './lib/referral';
import { captureCampaignFromUrl } from './lib/campaign';
import './tailwind.css';
import './styles.css';

// Before React mounts — App's URL-sync effect rewrites the address to a bare
// path on the first navigation, and ?ref would be gone with it.
captureReferralFromUrl();
captureCampaignFromUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* At the root, not inside a page — the cache has to outlive navigation
        for any of it to be worth having. */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
