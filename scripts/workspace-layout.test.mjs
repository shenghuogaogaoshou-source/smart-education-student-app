import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('两个创意游戏作为仓库内工作区存在', () => {
  const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
  assert.deepEqual(root.workspaces, ['apps/*', 'packages/*'])
  assert.equal(existsSync(new URL('../apps/brain-film/package.json', import.meta.url)), true)
  assert.equal(existsSync(new URL('../apps/creative-module/package.json', import.meta.url)), true)
})
