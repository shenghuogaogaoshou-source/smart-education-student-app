import { copyFile, mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIGURE_DATA_PREFIX = 'data:image/jpeg;base64,'

function parsePayload(row) {
  try {
    return JSON.parse(row.payload)
  } catch {
    return null
  }
}

function videoFileName(videoUrl) {
  if (typeof videoUrl !== 'string' || !videoUrl.startsWith('/api/films/')) return null
  const name = basename(decodeURIComponent(videoUrl))
  return name && name !== '.' && name !== '..' && name === decodeURIComponent(videoUrl).slice('/api/films/'.length)
    ? name
    : null
}

function posterPayload(payload) {
  for (const panel of payload?.panels ?? []) {
    if (typeof panel?.thumb === 'string' && panel.thumb.startsWith(FIGURE_DATA_PREFIX)) {
      return Buffer.from(panel.thumb.slice(FIGURE_DATA_PREFIX.length), 'base64')
    }
  }
  return null
}

function normalizePublishedAt(value) {
  if (!value) return undefined
  const source = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}+08:00`
  const date = new Date(source)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

export async function findLatestImportableBrainFilmWork(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    const rows = database.prepare(`
      SELECT id, title, director, style, pages, created_at, updated_at, payload
      FROM works
      ORDER BY updated_at DESC
    `).all()

    for (const row of rows) {
      const payload = parsePayload(row)
      const videoFile = videoFileName(payload?.videoUrl)
      const poster = posterPayload(payload)
      if (!videoFile || !poster) continue

      const videoPath = join(dirname(databasePath), 'films', videoFile)
      try {
        const info = await stat(videoPath)
        if (!info.isFile() || info.size <= 0) continue
        return {
          id: row.id,
          title: payload.title || row.title || '我的脑洞电影',
          director: payload.director || row.director || '',
          style: payload.style || row.style || '',
          pages: Number(row.pages) || 0,
          createdAt: normalizePublishedAt(row.created_at),
          publishedAt: normalizePublishedAt(row.updated_at || payload.savedAt),
          payload,
          videoFile,
          videoPath,
          videoByteSize: info.size,
          poster,
        }
      } catch {
        continue
      }
    }
  } finally {
    database.close()
  }

  throw new Error('没有找到同时包含完整影片、画面资源和作品元数据的脑洞放映厅作品。')
}

export async function exportBrainFilmWork({
  databasePath,
  publicDirectory,
  manifestPath,
}) {
  const selected = await findLatestImportableBrainFilmWork(databasePath)
  await mkdir(publicDirectory, { recursive: true })
  const posterFileName = `${selected.id.replace(/[^a-z0-9_-]/gi, '-')}-poster.jpg`
  const posterPath = join(publicDirectory, posterFileName)
  await copyFile(selected.videoPath, join(publicDirectory, selected.videoFile))
  await writeFile(posterPath, selected.poster)

  const manifest = {
    schemaVersion: 1,
    sourceDraftId: `brain-film-db:${selected.id}`,
    originalSourceId: selected.id,
    title: selected.title,
    description: selected.payload.synopsis || selected.payload.idea || selected.payload.story || '',
    aiTools: [...new Set([
      '脑洞放映厅',
      selected.payload.videoModel,
    ].filter(Boolean))],
    fileName: selected.videoFile,
    mimeType: 'video/mp4',
    byteSize: selected.videoByteSize,
    assetPath: `/brain-film-import/${selected.videoFile}`,
    thumbnailUrl: `/brain-film-import/${posterFileName}`,
    publishedAt: selected.publishedAt,
    director: selected.director,
    style: selected.style,
  }

  const resolvedManifestPath = manifestPath
    ?? join(dirname(publicDirectory), 'data', 'brain-film-import.json')
  await mkdir(dirname(resolvedManifestPath), { recursive: true })
  const temporaryPath = `${resolvedManifestPath}.tmp`
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf8')
  await rename(temporaryPath, resolvedManifestPath)
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const databasePath = resolve(
    process.argv[2] ?? join(projectRoot, 'apps', 'brain-film', 'data', 'bh.db'),
  )
  const publicDirectory = resolve(
    process.argv[3] ?? join(projectRoot, 'public', 'brain-film-import'),
  )
  const manifest = await exportBrainFilmWork({ databasePath, publicDirectory })
  console.log(`已导出《${manifest.title}》到 ${manifest.assetPath}`)
}
