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
        // App shell fallback so the app opens offline / on flaky mobile.
        navigateFallback: '/index.html',
        // Static pages served from /public that must NOT hit the SPA shell.
        navigateFallbackDenylist: [/^\/(privacy|terms)\.html$/, /^\/(robots\.txt|sitemap\.xml|site\.webmanifest)$/],
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
  },
});
