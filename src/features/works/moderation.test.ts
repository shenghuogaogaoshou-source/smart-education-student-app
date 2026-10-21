import { describe, expect, it } from 'vitest'
import { rankPublishedWorks, reviewComment, reviewForLocalDemo } from './moderation'
import type { WorkRecord } from './types'

function work(id: string, publishedAt: string, likes: number, favorites = 0, comments = 0): WorkRecord {
  return {
    id,
    ownerId: 'student-a',
    source: 'external-upload',
    title: id,
    description: '',
    aiTools: ['豆包'],
    status: 'published',
    assetId: `${id}-asset`,
    fileName: `${id}.txt`,
    mimeType: 'text/plain',
    byteSize: 1,
    previewKind: 'text',
    createdAt: publishedAt,
    updatedAt: publishedAt,
    publishedAt,
    likes,
    favorites,
    likedBy: [],
    favoritedBy: [],
    comments: Array.from({ length: comments }, (_, index) => ({
      id: `${id}-comment-${index}`,
      authorId: 'student-b',
      authorName: '小星',
      text: '真有趣',
      createdAt: publishedAt,
    })),
  }
}

describe('local work moderation', () => {
  it('不保存不礼貌留言并给出委婉提示', () => {
    expect(reviewComment('你真笨')).toEqual({
      allowed: false,
      message: '这句话可能让别人不舒服，换一种友好的说法再试试吧。',
    })
  })

  it('接受友好留言并限制长度', () => {
    expect(reviewComment('这个想法真有趣！')).toMatchObject({ allowed: true })
    expect(reviewComment('长'.repeat(81))).toMatchObject({ allowed: false })
  })

  it('只声称检查文本和文件类型安全', async () => {
    const result = await reviewForLocalDemo(work('安全作品', '2026-10-20T12:00:00+08:00', 1))
    expect(result.allowed).toBe(true)
    expect(result.message).toContain('文字与文件类型')
    expect(result.message).not.toContain('识别画面')
  })

  it('每日榜只包含当天发布作品并按热度排序', () => {
    const works = [
      work('today-new', '2026-10-20T11:00:00+08:00', 1),
      work('today-popular', '2026-10-20T09:00:00+08:00', 5, 2, 1),
      work('yesterday', '2026-10-19T18:00:00+08:00', 9),
    ]
    const ranked = rankPublishedWorks(works, 'day', new Date('2026-10-20T12:00:00+08:00'))
    expect(ranked.map((item) => item.id)).toEqual(['today-popular', 'today-new'])
  })
})
