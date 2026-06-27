import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// WellNest frontend. The dev server and (via Express) the production build are
// both reachable from a phone on the same Wi-Fi. No external requests are made.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'WellNest — Healing Routine',
        short_name: 'WellNest',
        description: 'A calm, private daily health & routine tracker.',
        theme_color: '#3c6f59',
        background_color: '#faf7f2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the app shell so the PWA opens offline. API calls are handled by
        // our own IndexedDB queue, so they are intentionally left to the network.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false, // keep dev fast; SW is exercised in the production build
      },
    }),
  ],
  server: {
    host: true, // 0.0.0.0 — reachable from the phone in dev
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
