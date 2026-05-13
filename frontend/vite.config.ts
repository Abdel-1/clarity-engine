import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    // Redirect all 404s to index.html so React Router handles routing
    historyApiFallback: true,
  },
})
