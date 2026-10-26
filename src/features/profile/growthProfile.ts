import type { GrowthScores, LearningEvent, LearningEventAction } from '../../app/learningEvents'
import type { GrowthTitle } from '../../app/model'

export type GrowthProfile = {
  scores: GrowthScores
  hasEvidence: boolean
  eventCount: number
}

const DIMENSIONS = ['curiosity', 'knowledge', 'problemSolving', 'creativity', 'planning'] as const
const NEUTRAL_SCORE = 40
const MAX_SCORE = 100

type TitleCandidate = Omit<GrowthTitle, 'eventId'>

const TITLE_CANDIDATES: Record<LearningEventAction, TitleCandidate[]> = {
  'knowledge-completed': [
    { text: '愿意多问一步的小探索家', description: '你认真看完了一段新知识，还留下了继续探索的线索。' },
    { text: '把新知识慢慢连起来的小研究员', description: '你正在把刚学到的内容和自己熟悉的经验慢慢连接起来。' },
    { text: '会从细节里找线索的小发现家', description: '你愿意停下来观察细节，这让新的知识变得更清楚。' },
  ],
  'test-passed': [
    { text: '愿意回头检查的小侦探', description: '你在挑战里愿意检查自己的思路，并一步步靠近答案。' },
    { text: '会换方法再试一次的小闯关家', description: '你没有被一次尝试困住，而是继续寻找可用的方法。' },
    { text: '越做越有主意的小实验员', description: '你在完成挑战时积累了新的判断，也更熟悉自己的思路。' },
  ],
  'correction-completed': [
    { text: '会从错误里找方法的小修理工', description: '你把一次错误变成了新的线索，并认真完成了订正。' },
    { text: '愿意再想一遍的小复盘员', description: '你愿意回头检查原来的想法，这份耐心很有价值。' },
    { text: '把漏掉线索拾回来的小侦探', description: '你找到了之前忽略的细节，并把它变成了新的理解。' },
  ],
  'work-completed': [
    { text: '把点子慢慢做出来的小创客', description: '你把一个想法保存成了真实作品，也留下了继续修改的空间。' },
    { text: '愿意试出新花样的手工家', description: '你在创作里尝试了自己的表达方式，让想法有了新的样子。' },
    { text: '让想象落到作品里的小设计师', description: '你正在把脑海里的画面一步步变成可以分享的作品。' },
  ],
  'schedule-completed': [
    { text: '会为明天留位置的小规划员', description: '你按自己的安排完成了一小步，也给接下来的学习留好了位置。' },
    { text: '按自己节奏前进的小时间家', description: '你在自己的节奏里完成了一项安排，这份稳定很珍贵。' },
    { text: '把学习安排照顾到心里的小领航员', description: '你开始更了解怎样的安排适合自己，并愿意为它行动。' },
  ],
}

export function deriveGrowthProfile(events: LearningEvent[], accountId: string): GrowthProfile {
  const accountEvents = events.filter((event) => event.accountId === accountId)
  const scores: GrowthScores = {
    curiosity: NEUTRAL_SCORE,
    knowledge: NEUTRAL_SCORE,
    problemSolving: NEUTRAL_SCORE,
    creativity: NEUTRAL_SCORE,
    planning: NEUTRAL_SCORE,
  }

  for (const event of accountEvents) {
    for (const dimension of DIMENSIONS) {
      scores[dimension] += event.dimensionDeltas[dimension]
    }
  }
  for (const dimension of DIMENSIONS) {
    scores[dimension] = Math.min(MAX_SCORE, Math.max(0, scores[dimension]))
  }

  return {
    scores,
    hasEvidence: accountEvents.length > 0,
    eventCount: accountEvents.length,
  }
}

export function chooseNextGrowthTitle(event: LearningEvent, previous: GrowthTitle | null): GrowthTitle {
  const dominantDimension = DIMENSIONS.reduce((current, candidate) => (
    event.dimensionDeltas[candidate] > event.dimensionDeltas[current] ? candidate : current
  ))
  const actionByDimension: Record<(typeof DIMENSIONS)[number], LearningEventAction> = {
    curiosity: 'knowledge-completed',
    knowledge: 'knowledge-completed',
    problemSolving: 'test-passed',
    creativity: 'work-completed',
    planning: 'schedule-completed',
  }
  const action = event.action === 'correction-completed'
    ? 'correction-completed'
    : actionByDimension[dominantDimension]
  const candidates = TITLE_CANDIDATES[action]
  const previousIndex = previous ? candidates.findIndex((candidate) => candidate.text === previous.text) : -1
  const candidate = candidates[(previousIndex + 1) % candidates.length]

  return { ...candidate, eventId: event.id }
}
