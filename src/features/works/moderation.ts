import type { WorkRecord } from './types'

export type RankingPeriod = 'day' | 'week' | 'year'

const BLOCKED_TERMS = ['笨蛋', '真笨', '蠢', '垃圾', '滚开', '讨厌你', '加微信', '裸聊', '色情']

export class WorkCommentRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkCommentRejected'
  }
}

function containsBlockedTerm(text: string) {
  return BLOCKED_TERMS.some((term) => text.includes(term))
}

export function reviewComment(text: string): { allowed: boolean; message: string } {
  const value = text.trim()
  if (!value) return { allowed: false, message: '先写下一句想说的话吧。' }
  if (value.length > 80) return { allowed: false, message: '留言最多写 80 个字，缩短一点再试试吧。' }
  if (containsBlockedTerm(value)) {
    return {
      allowed: false,
      message: '这句话可能让别人不舒服，换一种友好的说法再试试吧。',
    }
  }
  return { allowed: true, message: '留言已通过基础文字检查。' }
}

export interface WorkModerationService {
  review(work: WorkRecord): Promise<{ allowed: boolean; message: string }>
}

export const localDemoModeration: WorkModerationService = {
  async review(work) {
    const text = `${work.title}\n${work.description}\n${work.aiTools.join(' ')}`
    return containsBlockedTerm(text)
      ? { allowed: false, message: '有些内容需要换一种更适合大家阅读的表达。' }
      : { allowed: true, message: '基础文字与文件类型安全检查已通过。' }
  },
}

export function reviewForLocalDemo(work: WorkRecord) {
  return localDemoModeration.review(work)
}

function periodStart(period: RankingPeriod, now: Date) {
  const start = new Date(now)
  if (period === 'day') {
    start.setDate(start.getDate() - 1)
    return start
  }
  if (period === 'week') {
    start.setDate(start.getDate() - 7)
    return start
  }
  start.setFullYear(start.getFullYear() - 1)
  return start
}

export function rankPublishedWorks(works: WorkRecord[], period: RankingPeriod, now = new Date()) {
  const start = periodStart(period, now)
  return works
    .filter((work) => {
      if (work.status !== 'published' || !work.publishedAt) return false
      const published = new Date(work.publishedAt)
      return published >= start && published <= now
    })
    .sort((a, b) => {
      const scoreA = a.likes * 3 + a.favorites * 2 + a.comments.length
      const scoreB = b.likes * 3 + b.favorites * 2 + b.comments.length
      return scoreB - scoreA || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
    })
}
