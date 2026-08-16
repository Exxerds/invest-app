import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    // Every /api request is proxied to the Express server (server/src/index.js, port 4000)
    proxy: {
      '/api': {
        // IMPORTANT: use 127.0.0.1, NOT localhost.
        // On Windows (Node 18+) "localhost" resolves to IPv6 ::1 first, while the
        // API server listens on IPv4 — the proxy then fails with ECONNREFUSED and
        // the browser shows a 502 / "API server is not running" error on sign-in.
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
