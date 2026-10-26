import { describe, expect, it, vi } from 'vitest'
import { createMemoryWorkRepository } from './repository'
import { DEMO_WORK_SPECS, seedDemoWorks } from './demoWorks'

describe('demo work catalogue', () => {
  it('keeps every supplied work while excluding the reference screenshot', () => {
    expect(DEMO_WORK_SPECS).toHaveLength(25)
    expect(new Set(DEMO_WORK_SPECS.map((work) => work.assetPath)).size).toBe(25)

    const statuses = DEMO_WORK_SPECS.reduce<Record<string, number>>((result, work) => {
      result[work.status] = (result[work.status] ?? 0) + 1
      return result
    }, {})

    expect(statuses).toEqual({
      published: 17,
      draft: 3,
      reviewing: 3,
      private: 2,
    })
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

  it('seeds every work once and preserves the approved statuses', async () => {
    const repository = createMemoryWorkRepository()
    const loadAsset = async (path: string) => new Blob([path], {
      type: path.endsWith('.mp4') ? 'video/mp4' : 'image/png',
    })

    await seedDemoWorks(repository, 'chenxi_2026', loadAsset)
    await seedDemoWorks(repository, 'chenxi_2026', loadAsset)

    const works = await repository.list('chenxi_2026')
    expect(works).toHaveLength(25)
    expect(works.filter((work) => work.status === 'published')).toHaveLength(17)
    expect(works.filter((work) => work.status === 'draft')).toHaveLength(3)
    expect(works.filter((work) => work.status === 'reviewing')).toHaveLength(3)
    expect(works.filter((work) => work.status === 'private')).toHaveLength(2)
    expect(works.every((work) => work.sourceDraftId?.startsWith('demo-'))).toBe(true)
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
