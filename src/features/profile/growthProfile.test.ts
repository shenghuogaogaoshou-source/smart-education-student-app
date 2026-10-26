import { describe, expect, it } from 'vitest'
import { createLearningEvent } from '../../app/learningEvents'
import { chooseNextGrowthTitle, deriveGrowthProfile } from './growthProfile'

function knowledgeEvent(index: number, accountId = 'student-a') {
  return createLearningEvent({
    accountId,
    gradeBand: 'grade5-6',
    source: 'knowledge',
    contentId: `lesson-${index}`,
    action: 'knowledge-completed',
    occurredAt: `2026-10-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
  })
}

describe('growth profile', () => {
  it('derives a neutral profile and caps growth at one hundred', () => {
    expect(deriveGrowthProfile([], 'student-a')).toEqual({
      scores: { curiosity: 40, knowledge: 40, problemSolving: 40, creativity: 40, planning: 40 },
      hasEvidence: false,
      eventCount: 0,
    })

    const profile = deriveGrowthProfile(
      Array.from({ length: 20 }, (_, index) => knowledgeEvent(index)),
      'student-a',
    )
    expect(profile.scores.knowledge).toBe(100)
    expect(profile.scores.curiosity).toBe(80)
    expect(profile.hasEvidence).toBe(true)
    expect(profile.eventCount).toBe(20)
  })

  it('filters events by exact account id', () => {
    const profile = deriveGrowthProfile([
      knowledgeEvent(1, 'student-a'),
      knowledgeEvent(2, 'student-b'),
    ], 'student-a')

    expect(profile.eventCount).toBe(1)
    expect(profile.scores.knowledge).toBe(44)
  })

  it('chooses a different, non-comparative title for consecutive events', () => {
    const firstEvent = knowledgeEvent(1)
    const secondEvent = knowledgeEvent(2)
    const first = chooseNextGrowthTitle(firstEvent, null)
    const second = chooseNextGrowthTitle(secondEvent, first)

    expect(second.text).not.toBe(first.text)
    expect(`${first.text}${second.text}`).not.toMatch(/天才|第一|最强|落后|薄弱/)
    expect(`${first.description}${second.description}`).not.toMatch(/天才|第一|最强|落后|薄弱/)
  })
})
