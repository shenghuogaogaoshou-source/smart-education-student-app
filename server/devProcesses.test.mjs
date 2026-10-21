import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDevProcessSpecs } from './devProcesses.mjs'

test('dev 同时启动两个游戏且不打开浏览器', () => {
  const specs = buildDevProcessSpecs('C:/repo', ['--host', '127.0.0.1', '--port', '5175'])
  assert.deepEqual(specs.map((item) => item.name), ['ai-proxy', 'zhiya-web', 'brain-film', 'creative-module'])
  assert.equal(specs.some((item) => item.args.includes('--open')), false)
  assert.match(specs.find((item) => item.name === 'brain-film').args.join(' '), /5191/)
  assert.match(specs.find((item) => item.name === 'creative-module').args.join(' '), /5192/)
})
