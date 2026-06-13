import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // L'API Spring Boot tourne sur :8080 ; le front l'appelle via /api.
      '/api': 'http://localhost:8080',
    },
  },
})
