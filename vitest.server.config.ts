import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.mjs'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.worktrees/**',
      'server/devProcesses.test.mjs',
      'server/recognition.test.mjs',
    ],
  },
})
