import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import {
  applyCleanupPlan,
  assertSafeCleanupTarget,
  buildCleanupPlan,
} from './cleanup-project.mjs'

function createFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-cleanup-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  for (const directory of [
    'dist',
    'apps/brain-film/dist',
    'apps/brain-film/__pycache__',
    'apps/brain-film/tests/__pycache__',
    'android/app/build',
    'android/.gradle',
    'src',
    'public/courses/qmx',
    'public/demo-works/videos',
    'public/companion',
    'server',
    'apps/brain-film',
  ]) {
    mkdirSync(join(root, directory), { recursive: true })
  }

  for (const file of [
    'tsconfig.tsbuildinfo',
    'dev-out.txt',
    'src/main.ts',
    'public/courses/qmx/page.png',
    'public/demo-works/videos/clock.mp4',
    'public/companion/model.bin',
    'server/.env.local',
    'apps/brain-film/.env',
  ]) {
    writeFileSync(join(root, file), 'fixture')
  }

  return root
}

test('cleanup refuses project roots and protected content', (t) => {
  const root = createFixture(t)

  assert.throws(() => assertSafeCleanupTarget(root, root))
  assert.throws(() => assertSafeCleanupTarget(root, dirname(root)))

  for (const relativePath of [
    '.git/config',
    '.worktrees/old/file.txt',
    'src/main.ts',
    'public/courses/qmx/page.png',
    'public/demo-works/videos/clock.mp4',
    'public/companion/model.bin',
    'server/.env.local',
    'apps/brain-film/.env',
    'apps/brain-film/src/main.ts',
    'android/app/src/main/AndroidManifest.xml',
  ]) {
    assert.throws(
      () => assertSafeCleanupTarget(root, join(root, relativePath)),
      relativePath,
    )
  }

  assert.equal(assertSafeCleanupTarget(root, join(root, 'dist')), join(root, 'dist'))
})

test('cleanup plan contains only regenerated outputs and caches', (t) => {
  const root = createFixture(t)
  const plan = buildCleanupPlan(root)
  const paths = plan.map((entry) => entry.path)

  for (const expected of [
    'dist',
    'apps/brain-film/dist',
    'apps/brain-film/__pycache__',
    'apps/brain-film/tests/__pycache__',
    'android/app/build',
    'android/.gradle',
    'tsconfig.tsbuildinfo',
    'dev-out.txt',
  ]) {
    assert.ok(paths.includes(expected), expected)
  }

  assert.ok(!paths.some((entry) => entry.includes('.env')))
  assert.ok(!paths.some((entry) => entry.startsWith('src/')))
  assert.ok(!paths.some((entry) => entry.startsWith('public/courses/')))
  assert.ok(!paths.some((entry) => entry.startsWith('public/demo-works/')))
  assert.ok(!paths.some((entry) => entry.startsWith('public/companion/')))
  assert.ok(plan.every((entry) => entry.reason.length > 0))
})

test('apply removes only targets from a safe cleanup plan', (t) => {
  const root = createFixture(t)
  const plan = buildCleanupPlan(root)

  applyCleanupPlan(root, plan)

  assert.deepEqual(buildCleanupPlan(root), [])
  assert.equal(existsSync(join(root, 'public/courses/qmx/page.png')), true)
  assert.equal(existsSync(join(root, 'public/demo-works/videos/clock.mp4')), true)
  assert.equal(existsSync(join(root, 'public/companion/model.bin')), true)
  assert.equal(existsSync(join(root, 'server/.env.local')), true)
  assert.equal(existsSync(join(root, 'apps/brain-film/.env')), true)
})
