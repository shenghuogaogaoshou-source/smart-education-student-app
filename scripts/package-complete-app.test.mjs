import assert from 'node:assert/strict'
import test from 'node:test'
import { completeManifest, forbiddenCompletePath } from './package-complete-app.mjs'

test('complete package includes all runtime source and local demo configuration', () => {
  const manifest = completeManifest()

  assert.ok(manifest.includes('src'))
  assert.ok(manifest.includes('public'))
  assert.ok(manifest.includes('server'))
  assert.ok(manifest.includes('apps'))
  assert.ok(manifest.includes('packages'))
  assert.ok(manifest.includes('server/.env.local'))
  assert.ok(manifest.includes('apps/brain-film/.env'))
})

test('complete package excludes dependencies, builds, local logs and Git worktrees', () => {
  for (const file of [
    'node_modules/vite/package.json',
    'apps/creative-module/node_modules/react/package.json',
    'dist/index.html',
    'apps/brain-film/data/server.log',
    'tsconfig.tsbuildinfo',
    '.git/config',
    '.worktrees/old/file.txt',
  ]) {
    assert.equal(forbiddenCompletePath(file), true, file)
  }

  assert.equal(forbiddenCompletePath('server/.env.local'), false)
  assert.equal(forbiddenCompletePath('apps/brain-film/.env'), false)
  assert.equal(forbiddenCompletePath('public/demo-works/videos/clock.mp4'), false)
})
