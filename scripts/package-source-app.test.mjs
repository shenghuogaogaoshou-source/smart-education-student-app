import assert from 'node:assert/strict'
import test from 'node:test'
import {
  backendManifest,
  forbiddenPackagePath,
  frontendManifest,
} from './package-source-app.mjs'

test('frontend manifest contains the complete student app and both game frontends', () => {
  const manifest = frontendManifest()

  assert.ok(manifest.includes('src'))
  assert.ok(manifest.includes('public'))
  assert.ok(manifest.includes('apps/brain-film/src'))
  assert.ok(manifest.includes('apps/creative-module/src'))
  assert.ok(manifest.includes('packages/works-bridge'))
  assert.equal(manifest.includes('server'), false)
})

test('backend manifest contains only server-side AI and brain-film services', () => {
  const manifest = backendManifest()

  assert.ok(manifest.includes('server/ai-proxy.mjs'))
  assert.ok(manifest.includes('server/recognition.mjs'))
  assert.ok(manifest.includes('server/recognition.test.mjs'))
  assert.ok(manifest.includes('server/tts.test.mjs'))
  assert.ok(manifest.includes('apps/brain-film/server.py'))
  assert.equal(manifest.includes('src'), false)
  assert.equal(manifest.includes('public'), false)
})

test('package filter rejects secrets, dependencies, build output and local metadata', () => {
  for (const file of [
    '.env',
    'server/.env.local',
    'apps/brain-film/.env',
    'node_modules/vite/package.json',
    'apps/creative-module/node_modules/react/package.json',
    'dist/index.html',
    'dev-out.txt',
    '.worktrees/old/file.txt',
  ]) {
    assert.equal(forbiddenPackagePath(file), true, file)
  }

  assert.equal(forbiddenPackagePath('server/.env.local.example'), false)
  assert.equal(forbiddenPackagePath('src/main.tsx'), false)
})

