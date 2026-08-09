import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig(() => {
  const base = process.env.VITE_BASE_PATH || '/'

  return {
    base,
    resolve: {
      alias: {
        // data/ holds the build artefacts from scripts/. They are imported, not
        // fetched, so the service worker precaches them with everything else and
        // the app is genuinely offline on first install.
        '@data': fileURLToPath(new URL('./data', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-512x512.png'],
        manifest: {
          name: 'Lock In',
          short_name: 'Lock In',
          description: 'Rubik\'s Cube ZBLL Trainer',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ]
  }
})
