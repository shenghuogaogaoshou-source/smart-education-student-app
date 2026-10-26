import { describe, expect, it, vi } from 'vitest'
import { createMemoryWorkRepository } from './repository'
import { DEMO_WORK_SPECS, seedDemoWorks } from './demoWorks'
import type { WorkRecord } from './types'

type WorkWithCreator = WorkRecord & {
  creatorId?: string
  creatorName?: string
}

describe('demo work catalogue', () => {
  it('keeps every supplied work while excluding the reference screenshot', () => {
    expect(DEMO_WORK_SPECS).toHaveLength(25)
    expect(new Set(DEMO_WORK_SPECS.map((work) => work.assetPath)).size).toBe(25)
    expect(DEMO_WORK_SPECS.filter((work) => work.previewKind === 'image')).toHaveLength(17)
    expect(DEMO_WORK_SPECS.filter((work) => work.previewKind === 'video')).toHaveLength(8)
    expect(DEMO_WORK_SPECS.some((work) => work.assetPath.endsWith('/wonder-map.webp'))).toBe(false)
  })

  it('labels supplied and imported demo works as AI creations', () => {
    expect(DEMO_WORK_SPECS.every((work) => work.source === 'external-upload')).toBe(true)
  })

  it('uses browser-safe media paths and provides a poster for every video', () => {
    for (const work of DEMO_WORK_SPECS) {
      expect(work.assetPath).toMatch(/^\/demo-works\/(images|videos)\//)
      if (work.previewKind === 'video') {
        expect(work.posterPath).toMatch(/^\/demo-works\/posters\/.+\.jpg$/)
      }
    }
  })

  it('keeps a realistic mix of published, reviewing and private current-account works', async () => {
    const repository = createMemoryWorkRepository()
    const loadAsset = async (path: string) => new Blob([path], {
      type: path.endsWith('.mp4') ? 'video/mp4' : 'image/png',
    })

    await seedDemoWorks(repository, '123', loadAsset, new Date('2030-01-15T08:00:00.000Z'))

    const works = await repository.list('123') as WorkWithCreator[]
    expect(works).toHaveLength(25)
    expect(works.filter((work) => work.creatorId === '123')).toHaveLength(8)
    expect(works.filter((work) => work.creatorId === '123' && work.status === 'reviewing')).toHaveLength(1)
    expect(works.filter((work) => work.creatorId === '123' && work.status === 'private')).toHaveLength(1)
    expect(works.filter((work) => work.creatorId !== '123').every((work) => work.status === 'published')).toBe(true)
    expect(works.filter((work) => work.creatorId !== '123')).toHaveLength(17)
    expect(new Set(works
      .filter((work) => work.creatorId !== '123')
      .map((work) => work.creatorId))
      .size).toBe(6)
    expect(new Set(works
      .filter((work) => work.creatorId !== '123')
      .map((work) => work.creatorName)))
      .toEqual(new Set(['乐乐', '星禾', '米粒', '小宇', '朵朵', '安安']))
    expect(works.every((work) => work.sourceDraftId?.startsWith('demo-'))).toBe(true)
  })

  it('seeds real interaction lists and a few imported community favorites', async () => {
    const repository = createMemoryWorkRepository()

    const works = await seedDemoWorks(repository, '123')
    const published = works.filter((work) => work.status === 'published')
    const favorites = published.filter((work) => (
      work.creatorId !== '123' && work.favoritedBy.includes('123')
    ))

    expect(favorites).toHaveLength(3)
    expect(new Set(favorites.map((work) => work.creatorId)).size).toBe(3)
    expect(published.every((work) => work.likes === work.likedBy.length)).toBe(true)
    expect(published.every((work) => work.favorites === work.favoritedBy.length)).toBe(true)
    expect(published.every((work) => work.comments.length >= 2)).toBe(true)
  })

  it('migrates older demo ownership and statuses only once without erasing later user choices', async () => {
    const repository = createMemoryWorkRepository()
    const old = await repository.saveDraft('123', {
      source: 'creative-module',
      sourceDraftId: 'demo-image-1',
      creatorId: '123',
      creatorName: '晨曦同学',
      title: '旧演示作品',
      description: '旧数据',
      aiTools: [],
      fileName: 'old.webp',
      blob: new Blob(['old'], { type: 'image/webp' }),
    })
    await repository.setStatus('123', old.id, 'published')

    const migrated = await seedDemoWorks(repository, '123')
    const corrected = migrated.find((work) => work.sourceDraftId === 'demo-image-1')!
    expect(corrected.creatorId).toBe('virtual-author-lele')
    expect(corrected.source).toBe('external-upload')

    await repository.setStatus('123', corrected.id, 'private')
    await seedDemoWorks(repository, '123')
    expect((await repository.get('123', corrected.id))?.status).toBe('private')
  })

  it('keeps works actually generated in the creative games under their real source', async () => {
    const repository = createMemoryWorkRepository()
    const realFilm = await repository.saveDraft('123', {
      source: 'brain-film',
      sourceDraftId: 'brain-film-db:f1792422741163',
      title: '改项目',
      description: '真正由脑洞放映厅生成',
      aiTools: ['脑洞放映厅'],
      fileName: 'film.mp4',
      blob: new Blob(['film'], { type: 'video/mp4' }),
    })
    const realModule = await repository.saveDraft('123', {
      source: 'creative-module',
      sourceDraftId: 'creative-level-1',
      title: '光线感应器',
      description: '真正由创造模块生成',
      aiTools: ['创造模块'],
      fileName: 'module.png',
      blob: new Blob(['module'], { type: 'image/png' }),
    })

    await seedDemoWorks(repository, '123')

    expect((await repository.get('123', realFilm.id))?.source).toBe('brain-film')
    expect((await repository.get('123', realModule.id))?.source).toBe('creative-module')
  })

  it('anchors published times on first initialization and keeps them stable after refresh', async () => {
    const repository = createMemoryWorkRepository()
    const anchor = new Date('2030-01-15T08:00:00.000Z')
    const loadAsset = async (path: string) => new Blob([path], {
      type: path.endsWith('.mp4') ? 'video/mp4' : 'image/png',
    })

    const first = await seedDemoWorks(repository, '123', loadAsset, anchor)
    const firstTimes = new Map(first.map((work) => [work.id, work.publishedAt]))
    const second = await seedDemoWorks(
      repository,
      '123',
      loadAsset,
      new Date('2030-03-01T08:00:00.000Z'),
    )

    const oneDayAgo = anchor.getTime() - 24 * 60 * 60 * 1000
    const sevenDaysAgo = anchor.getTime() - 7 * 24 * 60 * 60 * 1000
    const oneYearAgo = new Date(anchor)
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1)

    const firstPublished = first.filter((work) => work.status === 'published')
    expect(firstPublished.filter((work) => (
      new Date(work.publishedAt!).getTime() >= oneDayAgo
    )).length).toBeGreaterThan(0)
    expect(firstPublished.filter((work) => (
      new Date(work.publishedAt!).getTime() >= sevenDaysAgo
    )).length).toBeGreaterThan(0)
    expect(firstPublished.filter((work) => (
      new Date(work.publishedAt!).getTime() >= oneYearAgo.getTime()
    ))).toHaveLength(23)
    expect(second.map((work) => [work.id, work.publishedAt]))
      .toEqual([...firstTimes.entries()])
    expect(second.map((work) => [work.id, work.publishedAt]))
      .toEqual(first.map((work) => [work.id, work.publishedAt]))
  })

  it('does not download the full demo media library while seeding metadata', async () => {
    const repository = createMemoryWorkRepository()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network should not be used'))

    await seedDemoWorks(repository, 'chenxi_2026')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await repository.list('chenxi_2026')).toHaveLength(25)
    fetchSpy.mockRestore()
  })

  it('removes demo entries that were created from an obsolete reference image', async () => {
    const repository = createMemoryWorkRepository()
    await repository.saveDraft('chenxi_2026', {
      source: 'creative-module',
      sourceDraftId: 'demo-image-18',
      title: '界面参考图',
      description: '不应作为作品保留',
      aiTools: [],
      fileName: 'wonder-map.webp',
      blob: new Blob(['reference']),
    })

    await seedDemoWorks(repository, 'chenxi_2026')

    const works = await repository.list('chenxi_2026')
    expect(works).toHaveLength(25)
    expect(works.some((work) => work.sourceDraftId === 'demo-image-18')).toBe(false)
  })
})
