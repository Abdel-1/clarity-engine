import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Keep legacy `max-width` media-query syntax (not the modern range
    // syntax) so responsive styles work on older mobile browsers
    // (e.g. iOS Safari < 16.4).
    cssTarget: ['safari14', 'chrome90'],
  },
  server: {
    port: 5173,
    strictPort: false,
    // Redirect all 404s to index.html so React Router handles routing
    historyApiFallback: true,
  },
})
