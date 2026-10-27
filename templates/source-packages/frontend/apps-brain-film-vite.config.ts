import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

const brainFilmApiOrigin =
  process.env.ZHIYA_BRAIN_FILM_API_ORIGIN || 'http://127.0.0.1:8766'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5191,
    strictPort: true,
    open: false,
    proxy: { '/api': brainFilmApiOrigin },
  },
})
