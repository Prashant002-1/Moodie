import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API target is configurable so the web client can run against the
// disposable preview API (npm run preview:demo) without touching a personal database.
const apiTarget = process.env.MOODIE_API_PROXY || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
    },
  },
})
