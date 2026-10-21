const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')

test('updated game sources satisfy TypeScript contracts', () => {
  assert.doesNotThrow(() => {
    execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx tsc -b --pretty false'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    })
  })
})
