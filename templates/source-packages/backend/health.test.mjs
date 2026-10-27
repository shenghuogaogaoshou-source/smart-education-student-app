import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildServiceSpecs, pythonCandidates } from '../start-all.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('backend starts the AI proxy and brain-film API on their documented ports', () => {
  const specs = buildServiceSpecs(root, pythonCandidates('win32')[0])

  assert.deepEqual(specs.map((spec) => spec.name), ['ai-proxy', 'brain-film-api'])
  assert.equal(existsSync(join(root, 'server', 'ai-proxy.mjs')), true)
  assert.equal(existsSync(join(root, 'apps', 'brain-film', 'server.py')), true)
  assert.match(specs[0].args.join(' '), /server[\\/]ai-proxy\.mjs/)
  assert.match(specs[1].args.join(' '), /server\.py.*8766/)
})
