import { beforeEach, describe, expect, it } from 'vitest'
import {
  createIndexedDbWorkRepository,
  createMemoryWorkRepository,
  detectPreviewKind,
  type WorkRepository,
} from './repository'

const draftInput = (title: string, sourceDraftId = 'film-1') => ({
  source: 'brain-film' as const,
  sourceDraftId,
  title,
  description: `${title} 的说明`,
  aiTools: ['脑洞放映厅'],
  fileName: `${title}.bhfilm`,
  blob: new Blob([title], { type: 'application/json' }),
})

describe.each([
  ['IndexedDB', (name: string) => createIndexedDbWorkRepository(name)],
  ['memory', () => createMemoryWorkRepository()],
] satisfies Array<[string, (name: string) => WorkRepository]>)('%s work repository', (_label, createRepository) => {
  let sequence = 0
  let repository: WorkRepository

  beforeEach(() => {
    sequence += 1
    repository = createRepository(`zhiya-works-test-${sequence}`)
  })

  it('按账号保存 Blob 草稿并完成发布生命周期', async () => {
    const draft = await repository.saveDraft('account-a', draftInput('云朵电影院'))

    expect(draft).toMatchObject({
      ownerId: 'account-a',
      source: 'brain-film',
      title: '云朵电影院',
      status: 'draft',
      previewKind: 'generic',
      likes: 0,
      favorites: 0,
      likedBy: [],
      favoritedBy: [],
      comments: [],
    })
    expect(await repository.list('account-b')).toEqual([])

    await repository.setStatus('account-a', draft.id, 'reviewing')
    const published = await repository.setStatus('account-a', draft.id, 'published')
    expect(published.status).toBe('published')
    expect(published.publishedAt).toBeTruthy()
    expect(await (await repository.getAsset('account-a', draft.assetId))?.text()).toBe('云朵电影院')
  })

  it('相同来源草稿更新原记录而不是重复创建', async () => {
    const first = await repository.saveDraft('account-a', draftInput('第一版'))
    const updated = await repository.saveDraft('account-a', draftInput('第二版'))

    expect(updated.id).toBe(first.id)
    expect((await repository.list('account-a'))).toHaveLength(1)
    expect(updated.title).toBe('第二版')
    expect(await (await repository.getAsset('account-a', first.assetId))?.text()).toBe('第二版')
  })

  it('持久化互动字段且按账号隔离', async () => {
    const work = await repository.saveDraft('account-a', draftInput('互动作品'))
    const updated = await repository.update('account-a', work.id, {
      likes: 3,
      favorites: 2,
      likedBy: ['student-1', 'student-2', 'student-3'],
      favoritedBy: ['student-1', 'student-2'],
      comments: [{
        id: 'comment-1',
        authorId: 'student-1',
        authorName: '小星',
        text: '这个想法真有趣！',
        createdAt: '2026-10-20T12:00:00.000Z',
      }],
    })

    expect(updated.likes).toBe(3)
    expect(updated.comments[0].text).toBe('这个想法真有趣！')
    expect(await repository.get('account-b', work.id)).toBeUndefined()
  })

  it('删除作品时一并删除 Blob', async () => {
    const work = await repository.saveDraft('account-a', draftInput('待删除作品'))
    await repository.delete('account-a', work.id)

    expect(await repository.list('account-a')).toEqual([])
    expect(await repository.getAsset('account-a', work.assetId)).toBeUndefined()
  })

  it('按 MIME 和扩展名识别安全预览类型', () => {
    expect(detectPreviewKind('image/png', 'drawing.png')).toBe('image')
    expect(detectPreviewKind('video/mp4', 'film.mp4')).toBe('video')
    expect(detectPreviewKind('audio/mpeg', 'voice.mp3')).toBe('audio')
    expect(detectPreviewKind('text/plain', 'story.txt')).toBe('text')
    expect(detectPreviewKind('application/octet-stream', 'story.md')).toBe('text')
    expect(detectPreviewKind('application/pdf', 'poster.pdf')).toBe('pdf')
    expect(detectPreviewKind('', 'model.custom-ai')).toBe('generic')
    expect(detectPreviewKind('application/zip', 'model.custom-ai')).toBe('generic')
  })
})
