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

  it('uses browser-safe media paths and provides a poster for every video', () => {
    for (const work of DEMO_WORK_SPECS) {
      expect(work.assetPath).toMatch(/^\/demo-works\/(images|videos)\//)
      if (work.previewKind === 'video') {
        expect(work.posterPath).toMatch(/^\/demo-works\/posters\/.+\.jpg$/)
      }
    }
  })

  it('publishes every work with 8 current-account and 17 multi-author contributions', async () => {
    const repository = createMemoryWorkRepository()
    const loadAsset = async (path: string) => new Blob([path], {
      type: path.endsWith('.mp4') ? 'video/mp4' : 'image/png',
    })

    await seedDemoWorks(repository, '123', loadAsset, new Date('2030-01-15T08:00:00.000Z'))

    const works = await repository.list('123') as WorkWithCreator[]
    expect(works).toHaveLength(25)
    expect(works.every((work) => work.status === 'published')).toBe(true)
    expect(works.filter((work) => work.creatorId === '123')).toHaveLength(8)
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

    expect(first.filter((work) => (
      new Date(work.publishedAt!).getTime() >= oneDayAgo
    )).length).toBeGreaterThan(0)
    expect(first.filter((work) => (
      new Date(work.publishedAt!).getTime() >= sevenDaysAgo
    )).length).toBeGreaterThan(0)
    expect(first.filter((work) => (
      new Date(work.publishedAt!).getTime() >= oneYearAgo.getTime()
    ))).toHaveLength(25)
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
