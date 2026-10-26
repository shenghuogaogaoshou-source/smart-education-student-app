import { describe, expect, it } from 'vitest'
import { createLearningEvent, type LearningEvent } from '../../app/learningEvents'
import { getPartIdsForBand } from '../../app/learning'
import type { WrongAnswerRecord } from '../../app/model'
import { COURSE_PACKAGES } from '../knowledge/courseCatalog'
import { deriveCourseAchievementGroups, getAchievementSummary } from './courseAchievements'

function eventFor(
  band: 'grade1-2' | 'grade3-4' | 'grade5-6',
  partId: string,
  action: 'knowledge-completed' | 'test-passed',
  index = 0,
): LearningEvent {
  const occurredAt = `2026-10-${String(20 + index).padStart(2, '0')}T09:00:00.000Z`
  return action === 'knowledge-completed'
    ? createLearningEvent({
        accountId: 'student-a',
        gradeBand: band,
        source: 'knowledge',
        contentId: partId,
        action,
        occurredAt,
      })
    : createLearningEvent({
        accountId: 'student-a',
        gradeBand: band,
        source: 'test',
        contentId: partId,
        action,
        occurredAt,
      })
}

function allEvents(band: 'grade1-2' | 'grade3-4' | 'grade5-6') {
  return getPartIdsForBand(band).flatMap((partId, index) => [
    eventFor(band, partId, 'knowledge-completed', index),
    eventFor(band, partId, 'test-passed', index),
  ])
}

describe('course achievements', () => {
  it('builds the approved 17, 13 and 19 achievement groups', () => {
    const groups = deriveCourseAchievementGroups([], 'student-a')

    expect(groups['grade1-2']).toHaveLength(17)
    expect(groups['grade3-4']).toHaveLength(13)
    expect(groups['grade5-6']).toHaveLength(19)
    expect(Object.values(groups).flat()).toHaveLength(49)
  })

  it('earns paired medals and the finale from exact events with dates', () => {
    const groups = deriveCourseAchievementGroups(allEvents('grade1-2'), 'student-a')

    expect(groups['grade1-2'].find(({ id }) => id === 'qmx-1:knowledge')).toMatchObject({
      earned: true,
      earnedAt: '2026-10-20T09:00:00.000Z',
      statusText: '已获得 · 2026-10-20',
    })
    expect(groups['grade1-2'].find(({ id }) => id === 'qmx-finale')).toMatchObject({
      earned: true,
      statusText: '已获得 · 2026-10-27',
    })
  })

  it('uses unresolved wrong answers only for the gentle retry status', () => {
    const partId = COURSE_PACKAGES['grade5-6'].parts[0].id
    const knowledge = eventFor('grade5-6', partId, 'knowledge-completed')
    const wrongAnswer: WrongAnswerRecord = {
      id: `grade5-6:${partId}:q1`,
      gradeBand: 'grade5-6',
      partId,
      questionId: 'q1',
      prompt: '题目',
      options: ['正确', '错误'],
      selectedIndex: 1,
      answerIndex: 0,
      explanation: '解释',
      occurredAt: '2026-10-26T09:00:00.000Z',
      correctedAt: null,
    }
    const groups = deriveCourseAchievementGroups([knowledge], 'student-a', [wrongAnswer])

    expect(groups['grade5-6'].find(({ id }) => id === `${partId}:challenge`)?.statusText)
      .toBe('再试一次，订正后继续挑战')
  })

  it('summarizes all three groups against the fixed 49-medal total', () => {
    const groups = deriveCourseAchievementGroups(allEvents('grade3-4'), 'student-a')
    expect(getAchievementSummary(groups)).toEqual({
      earnedCount: 13,
      totalCount: 49,
    })
  })
})
