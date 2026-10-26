import type { WorkRepository } from './types'

export type ImportedBrainFilmManifest = {
  schemaVersion: 1
  sourceDraftId: string
  originalSourceId: string
  title: string
  description: string
  aiTools: string[]
  fileName: string
  mimeType: string
  byteSize: number
  assetPath: string
  thumbnailUrl: string
  publishedAt?: string
  director?: string
  style?: string
}

export type ImportedAssetLoader = (assetPath: string) => Promise<Blob>

function isImportedManifest(value: unknown): value is ImportedBrainFilmManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<ImportedBrainFilmManifest>
  return manifest.schemaVersion === 1
    && typeof manifest.sourceDraftId === 'string'
    && typeof manifest.title === 'string'
    && typeof manifest.description === 'string'
    && Array.isArray(manifest.aiTools)
    && typeof manifest.fileName === 'string'
    && typeof manifest.mimeType === 'string'
    && typeof manifest.byteSize === 'number'
    && typeof manifest.assetPath === 'string'
    && typeof manifest.thumbnailUrl === 'string'
}

export async function fetchImportedBrainFilmManifest(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<ImportedBrainFilmManifest | undefined> {
  try {
    const response = await fetcher('/data/brain-film-import.json', { cache: 'no-store' })
    if (!response.ok) return undefined
    const value: unknown = await response.json()
    return isImportedManifest(value) ? value : undefined
  } catch {
    return undefined
  }
}

export async function fetchImportedAsset(
  assetPath: string,
  fetcher: typeof fetch = globalThis.fetch,
) {
  const response = await fetcher(assetPath, { cache: 'force-cache' })
  if (!response.ok) throw new Error('imported-work-asset-unavailable')
  return response.blob()
}

export async function seedImportedBrainFilmWork(
  repository: WorkRepository,
  accountId: string,
  manifest: ImportedBrainFilmManifest,
  loadAsset: ImportedAssetLoader = fetchImportedAsset,
) {
  const existing = await repository.list(accountId)
  if (existing.some((work) => (
    work.source === 'brain-film'
    && work.sourceDraftId === manifest.sourceDraftId
  ))) {
    return existing
  }

  const blob = await loadAsset(manifest.assetPath)
  const draft = await repository.saveDraft(accountId, {
    source: 'brain-film',
    sourceDraftId: manifest.sourceDraftId,
    creatorId: accountId,
    creatorName: '晨曦同学',
    title: manifest.title,
    description: manifest.description,
    aiTools: manifest.aiTools,
    fileName: manifest.fileName,
    thumbnailUrl: manifest.thumbnailUrl,
    blob,
  })
  const published = await repository.setStatus(accountId, draft.id, 'published')
  if (manifest.publishedAt) {
    await repository.update(accountId, published.id, {
      publishedAt: manifest.publishedAt,
    })
  }
  return repository.list(accountId)
}
