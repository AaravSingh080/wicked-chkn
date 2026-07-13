import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // never let the customer PWA's service worker hijack the admin or API
        navigateFallbackDenylist: [/^\/admin/, /^\/api/],
        runtimeCaching: [
          {
            // offline menu — serve cached copy instantly, refresh in background
            urlPattern: /\/api\/(menu|config)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'sb-api', expiration: { maxEntries: 8, maxAgeSeconds: 86400 } }
          },
          {
            urlPattern: /fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'sb-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } }
          }
        ]
      },
      manifest: {
        name: 'Wicked Chkn — Wicked. Crispy. Served hot.',
        short_name: 'Wicked Chkn',
        description: 'Order wicked burgers, burritos and wedges direct from Wicked Chkn, BRS Nagar Ludhiana — skip the aggregator markups.',
        theme_color: '#4A0E0B',
        background_color: '#4A0E0B',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  server: {
    port: 5273,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true }
    }
  }
});
