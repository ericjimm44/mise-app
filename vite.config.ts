/// <reference types="vitest" />
// defineConfig comes from vitest/config so the `test` block below type-checks.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Deployed to GitHub Pages at ericjimm44.github.io/mise-app/
  base: '/mise-app/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mise',
        short_name: 'Mise',
        description:
          'A lesson disguised as dinner. Recipes built on named techniques; the skill is what you keep.',
        // Paper base — matches contract tokens.paper. Keep in sync.
        theme_color: '#F7F5F1',
        background_color: '#F7F5F1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/mise-app/',
        scope: '/mise-app/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cook Mode must work with zero signal — a kitchen is a dead zone.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],

  resolve: {
    alias: {
      '@contract': fileURLToPath(new URL('./src/contract', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
