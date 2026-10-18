import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Development: forward /api/* to the FastAPI backend (start it on port 8000).
      // For production set VITE_API_BASE_URL instead; the backend must allow this origin via CORS.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
