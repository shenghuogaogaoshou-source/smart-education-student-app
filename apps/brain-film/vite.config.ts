import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/embedded-games/brain-film/' : '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5191,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8766' },
  },
}))
