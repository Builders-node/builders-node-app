import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update the SW: new content installs in the background and swaps in
      // on next visit — no update prompt needed for a first PWA rollout.
      registerType: 'autoUpdate',
      // We already ship /site.webmanifest; don't let the plugin generate a
      // second manifest that would ship inconsistent metadata.
      manifest: false,
      workbox: {
        // Precache the app shell (built assets).
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
        // Never the guides. sw.js is public, so precaching them would print
        // their unguessable paths — the only thing gating them — for anyone to
        // read, and download them into every visitor's browser besides.
        globIgnores: ['g/**'],
        // App shell fallback so the app opens offline / on flaky mobile.
        navigateFallback: '/index.html',
        // Static pages served from /public that must NOT hit the SPA shell.
        // The guides too: no longer precached, so without this a returning
        // visitor's service worker would answer them with the app shell.
        navigateFallbackDenylist: [/^\/(privacy|terms)\.html$/, /^\/(robots\.txt|sitemap\.xml|site\.webmanifest)$/, /^\/g\//],
        // Runtime image cache so photos load fast on repeat visits.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Register the SW automatically in the built app (works in prod).
      injectRegister: 'auto',
      // Don't ship a SW in dev — it would cache aggressively and hide fresh code.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // `ca.localhost` resolves to 127.0.0.1 on its own, so the CA subdomain can
    // be browsed locally on the host it actually uses in production rather than
    // through a `?site=ca` query that every internal link would drop. Vite 6
    // rejects unknown Host headers unless they're listed here.
    allowedHosts: ['.localhost'],
  },
});
