import { describe, expect, it, vi } from 'vitest'
import {
  seedImportedBrainFilmWork,
  type ImportedBrainFilmManifest,
} from './importedWorks'
import { createMemoryWorkRepository } from './repository'

const manifest: ImportedBrainFilmManifest = {
  schemaVersion: 1,
  sourceDraftId: 'brain-film-db:f1792422741163',
  originalSourceId: 'f1792422741163',
  title: '改项目',
  description: '五个同伴在实验室里一起修改项目。',
  aiTools: ['脑洞放映厅', 'Seedance + GLM-TTS'],
  fileName: 'film-20261019-214652-855.mp4',
  mimeType: 'video/mp4',
  byteSize: 17,
  assetPath: '/brain-film-import/film-20261019-214652-855.mp4',
  thumbnailUrl: '/brain-film-import/f1792422741163-poster.jpg',
  publishedAt: '2026-10-25T02:53:23.000Z',
}

describe('imported brain film work', () => {
  it('imports the completed film exactly once and publishes it to the current account', async () => {
    const repository = createMemoryWorkRepository()
    const loadAsset = vi.fn(async () => new Blob(['video'], { type: 'video/mp4' }))

    await seedImportedBrainFilmWork(repository, '123', manifest, loadAsset)
    await seedImportedBrainFilmWork(repository, '123', manifest, loadAsset)

    const works = await repository.list('123')
    expect(works).toHaveLength(1)
    expect(works[0]).toMatchObject({
      source: 'brain-film',
      sourceDraftId: 'brain-film-db:f1792422741163',
      creatorId: '123',
      creatorName: '晨曦同学',
      title: '改项目',
      status: 'published',
      previewKind: 'video',
      thumbnailUrl: '/brain-film-import/f1792422741163-poster.jpg',
      publishedAt: '2026-10-25T02:53:23.000Z',
    })
    expect(loadAsset).toHaveBeenCalledOnce()
    expect(await (await repository.getAsset('123', works[0].assetId))?.text()).toBe('video')
  })
})
