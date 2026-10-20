import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/companionPolicy.test.mjs', 'server/tts.test.mjs'],
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  },
})
