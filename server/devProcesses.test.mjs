import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDevProcessSpecs } from './devProcesses.mjs'

test('dev 同时启动两个游戏、脑洞后端且不打开浏览器', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const specs = buildDevProcessSpecs(root, ['--host', '127.0.0.1', '--port', '5175'])
  assert.deepEqual(specs.map((item) => item.name), ['ai-proxy', 'brain-api', 'zhiya-web', 'brain-film', 'creative-module'])
  assert.equal(specs.some((item) => item.args.includes('--open')), false)
  const brainApi = specs.find((item) => item.name === 'brain-api')
  const aiProxy = specs.find((item) => item.name === 'ai-proxy')
  assert.equal(aiProxy.resilient, true)
  assert.equal(aiProxy.env.BRAIN_INTERNAL_ORIGIN, 'http://127.0.0.1:8766')
  assert.equal(brainApi.resilient, true)
  assert.match(brainApi.args.join(' '), /server\.py.*8766/)
  assert.equal(brainApi.env.PYTHONUTF8, '1')
  assert.equal(brainApi.env.PYTHONIOENCODING, 'utf-8')
  assert.match(specs.find((item) => item.name === 'brain-film').args.join(' '), /5191/)
  assert.match(specs.find((item) => item.name === 'creative-module').args.join(' '), /5192/)
  for (const name of ['zhiya-web', 'brain-film', 'creative-module']) {
    assert.equal(existsSync(specs.find((item) => item.name === name).args[0]), true, `${name} Vite CLI exists`)
  }
})

test('embedded games resolve the same React runtime as the main app', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const reactVersion = (appRoot) => {
    const appRequire = createRequire(join(appRoot, 'package.json'))
    const packagePath = appRequire.resolve('react/package.json')
    return JSON.parse(readFileSync(packagePath, 'utf8')).version
  }
  const mainVersion = reactVersion(root)

  for (const app of ['brain-film', 'creative-module']) {
    assert.equal(reactVersion(join(root, 'apps', app)), mainVersion, `${app} shares the main React runtime`)
  }
})
