const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')

test('updated game sources satisfy TypeScript contracts', () => {
  assert.doesNotThrow(() => {
    const tsc = require.resolve('typescript/bin/tsc', { paths: [process.cwd()] })
    execFileSync(process.execPath, [tsc, '-b', '--pretty', 'false'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    })
  })
})
