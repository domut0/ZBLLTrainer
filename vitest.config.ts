import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Deliberately separate from vite.config.ts: the PWA plugin has nothing to
// offer a test run and generating a service worker per suite is just noise.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
