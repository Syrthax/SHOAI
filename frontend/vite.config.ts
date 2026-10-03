import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@elah/editor', '@elah/core', '@elah/react', '@elah/timeline', 'mediabunny'],
    // Pre-bundle icons into one file. Otherwise the excluded Elah packages pull in ~1500 separate
    // icon modules, and ad blockers (AdGuard etc.) block ones like `fingerprint.js`, which blanks the app.
    include: ['lucide-react'],
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
