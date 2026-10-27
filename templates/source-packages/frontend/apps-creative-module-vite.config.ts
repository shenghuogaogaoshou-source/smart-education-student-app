import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

const creativeApiOrigin =
  process.env.ZHIYA_CREATIVE_API_ORIGIN || 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5192,
    strictPort: true,
    open: false,
    proxy: { '/api': creativeApiOrigin },
  },
})
