import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('repository is noncommercial and CI has least privilege', () => {
  assert.match(read('LICENSE'), /PolyForm Noncommercial License 1\.0\.0/)
  assert.match(read('README.md'), /禁止商业使用/)
  assert.match(read('SECURITY.md'), /不要在 Issue|不得在 Issue/)
  assert.match(read('.github/workflows/ci.yml'), /permissions:\s*\n\s*contents: read/)
  assert.match(read('.github/CODEOWNERS'), /@shenghuogaogaoshou-source/)
})
