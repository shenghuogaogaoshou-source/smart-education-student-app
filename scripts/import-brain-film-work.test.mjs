import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import {
  exportBrainFilmWork,
  findLatestImportableBrainFilmWork,
} from './import-brain-film-work.mjs'

const posterDataUrl = `data:image/jpeg;base64,${Buffer.from('poster').toString('base64')}`

function payload(id, videoUrl) {
  return {
    id,
    director: '桥川',
    intern: '小爱同学',
    title: '会呼吸的时钟',
    synopsis: '一座老时钟在晨光里重新转动。',
    style: '蜡笔涂鸦',
    videoUrl,
    videoModel: 'Seedance + GLM-TTS',
    panels: [{ cap: '晨光里的时钟', svg: '<svg></svg>', thumb: posterDataUrl }],
  }
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'zhiya-brain-film-'))
  const films = join(root, 'films')
  const publicDirectory = join(root, 'public', 'brain-film-import')
  await mkdir(films, { recursive: true })
  await writeFile(join(films, 'complete.mp4'), Buffer.from('complete film'))

  const databasePath = join(root, 'bh.db')
  const db = new DatabaseSync(databasePath)
  db.exec(`
    CREATE TABLE works (
      id TEXT PRIMARY KEY, title TEXT, director TEXT, style TEXT,
      pages INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, payload TEXT
    )
  `)
  const insert = db.prepare(`
    INSERT INTO works (id, title, director, style, pages, created_at, updated_at, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insert.run(
    'missing-resource',
    '缺少影片',
    '桥川',
    '蜡笔涂鸦',
    1,
    '2026-10-26T09:00:00',
    '2026-10-26T09:00:00',
    JSON.stringify(payload('missing-resource', '/api/films/missing.mp4')),
  )
  insert.run(
    'complete-work',
    '会呼吸的时钟',
    '桥川',
    '蜡笔涂鸦',
    1,
    '2026-10-25T10:00:00',
    '2026-10-25T10:00:00',
    JSON.stringify(payload('complete-work', '/api/films/complete.mp4')),
  )
  db.close()

  return {
    root,
    databasePath,
    publicDirectory,
    async cleanup() {
      await rm(root, { recursive: true, force: true })
    },
  }
}

test('selects the latest completed work whose film resource exists', async (t) => {
  const files = await fixture()
  t.after(() => files.cleanup())

  const selected = await findLatestImportableBrainFilmWork(files.databasePath)
  assert.equal(selected.id, 'complete-work')
  assert.equal(selected.videoFile, 'complete.mp4')
})

test('exports one browser-ready manifest, film copy and poster', async (t) => {
  const files = await fixture()
  t.after(() => files.cleanup())

  const manifest = await exportBrainFilmWork({
    databasePath: files.databasePath,
    publicDirectory: files.publicDirectory,
  })

  assert.equal(manifest.sourceDraftId, 'brain-film-db:complete-work')
  assert.equal(manifest.title, '会呼吸的时钟')
  assert.equal(manifest.assetPath, '/brain-film-import/complete.mp4')
  assert.equal(manifest.thumbnailUrl, '/brain-film-import/complete-work-poster.jpg')
  assert.equal(await readFile(join(files.publicDirectory, 'complete.mp4'), 'utf8'), 'complete film')
  assert.equal(await readFile(join(files.publicDirectory, 'complete-work-poster.jpg'), 'utf8'), 'poster')
  const savedManifest = JSON.parse(await readFile(
    join(files.publicDirectory, '..', 'data', 'brain-film-import.json'),
    'utf8',
  ))
  assert.deepEqual(savedManifest, manifest)
})
