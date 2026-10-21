import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateCompanionAssetTree } from './validate-companion-2d-assets.mjs'

const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'zhizya-companion-2d-'))
  roots.push(root)
  return root
}

function frame(direction, layers) {
  return {
    direction,
    canvas: { width: 1024, height: 1024 },
    origin: { x: 512, y: 928 },
    visualBounds: { x: 120, y: 70, width: 784, height: 858 },
    layers,
  }
}

test('reports a missing direction and a direction without its body layer', async () => {
  const root = await makeFixture()
  const directions = [
    'front', 'front-right', 'right', 'back-right',
    'back', 'back-left', 'left',
  ]
  const frames = Object.fromEntries(directions.map((direction) => [
    direction,
    frame(direction, direction === 'back' ? [] : [{ name: 'body', url: `/companions-2d/momo/${direction}/body.webp` }]),
  ]))

  const report = await validateCompanionAssetTree(root, [{ id: 'momo', frames }])

  assert.ok(report.errors.includes('momo/back: missing layer body'))
  assert.ok(report.errors.includes('momo: missing direction front-left'))
})

test('accepts complete transparent WebP layer files with bounded metadata', async () => {
  const root = await makeFixture()
  const directions = [
    'front', 'front-right', 'right', 'back-right',
    'back', 'back-left', 'left', 'front-left',
  ]
  const frames = {}
  for (const direction of directions) {
    const directory = join(root, 'companions-2d', 'momo', direction)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'body.webp'), 'fixture')
    const layers = [{ name: 'body', url: `/companions-2d/momo/${direction}/body.webp` }]
    if (direction === 'front') {
      await writeFile(join(directory, 'eyes.webp'), 'fixture')
      await writeFile(join(directory, 'mouth.webp'), 'fixture')
      layers.push(
        { name: 'eyes', url: `/companions-2d/momo/${direction}/eyes.webp` },
        { name: 'mouth', url: `/companions-2d/momo/${direction}/mouth.webp` },
      )
    }
    frames[direction] = frame(direction, layers)
  }

  const report = await validateCompanionAssetTree(root, [{ id: 'momo', frames }])

  assert.deepEqual(report.errors, [])
  assert.equal(report.filesChecked, 10)
})
