import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/companion': 'http://127.0.0.1:8787',
      '/api/tts': 'http://127.0.0.1:8787',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    testTimeout: 30_000,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  },
  build: {
    target: 'es2015',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        assetFileNames: 'assets/index.[ext]',
      },
    },
  },
})
