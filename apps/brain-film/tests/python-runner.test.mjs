import test from 'node:test'
import assert from 'node:assert/strict'
import { pythonCandidates } from '../scripts/run-python-tests.mjs'

test('Windows 优先使用 py 启动器，并保留 python/python3 兜底', () => {
  assert.deepEqual(pythonCandidates('win32'), [
    { command: 'py', prefix: ['-3'] },
    { command: 'python', prefix: [] },
    { command: 'python3', prefix: [] },
  ])
})

test('非 Windows 优先使用 python3', () => {
  assert.deepEqual(pythonCandidates('linux'), [
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
  ])
})
