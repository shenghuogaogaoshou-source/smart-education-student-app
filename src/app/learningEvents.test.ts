import { describe, expect, it } from 'vitest'
import {
  appendLearningEvent,
  createLearningEvent,
  eventKey,
  normalizeLearningEvents,
  type LearningEventAction,
} from './learningEvents'

const ACTION_CASES: Array<[
  LearningEventAction,
  'knowledge' | 'test' | 'correction' | 'creative' | 'schedule',
  { curiosity: number; knowledge: number; problemSolving: number; creativity: number; planning: number },
]> = [
  ['knowledge-completed', 'knowledge', { curiosity: 2, knowledge: 4, problemSolving: 0, creativity: 0, planning: 0 }],
  ['test-passed', 'test', { curiosity: 0, knowledge: 2, problemSolving: 4, creativity: 0, planning: 0 }],
  ['correction-completed', 'correction', { curiosity: 0, knowledge: 0, problemSolving: 2, creativity: 0, planning: 2 }],
  ['work-completed', 'creative', { curiosity: 2, knowledge: 0, problemSolving: 0, creativity: 4, planning: 0 }],
  ['schedule-completed', 'schedule', { curiosity: 0, knowledge: 0, problemSolving: 0, creativity: 0, planning: 3 }],
]

describe('learning events', () => {
  it.each(ACTION_CASES)('maps %s to the approved dimensions', (action, source, expected) => {
    const event = createLearningEvent({
      accountId: 'student-a',
      gradeBand: 'grade1-2',
      source,
      contentId: 'qmx-1',
      action,
      occurredAt: '2026-10-26T09:00:00.000Z',
    })

    expect(event.dimensionDeltas).toEqual(expected)
  })

  it('uses an account-band-action-content key as the stable id and suppresses duplicates', () => {
    const input = {
      accountId: 'student-a',
      gradeBand: 'grade1-2' as const,
      source: 'knowledge' as const,
      contentId: 'qmx-1',
      action: 'knowledge-completed' as const,
      occurredAt: '2026-10-26T09:00:00.000Z',
    }
    const event = createLearningEvent(input)
    const events = [event]

    expect(event.id).toBe('student-a:grade1-2:knowledge-completed:qmx-1')
    expect(eventKey(input)).toBe(event.id)
    expect(appendLearningEvent(events, event)).toBe(events)
    expect(appendLearningEvent([], event)).toEqual([event])
  })

  it('rejects a known action paired with the wrong source', () => {
    const invalidInput = {
      accountId: 'student-a',
      gradeBand: 'grade1-2',
      source: 'test',
      contentId: 'qmx-1',
      action: 'knowledge-completed',
      occurredAt: '2026-10-26T09:00:00.000Z',
    } as unknown as Parameters<typeof createLearningEvent>[0]

    expect(() => createLearningEvent(invalidInput)).toThrow('学习事件的来源必须与完成动作匹配')
  })

  it('keeps otherwise identical records isolated by account and grade band', () => {
    const first = createLearningEvent({
      accountId: 'student-a', gradeBand: 'grade1-2', source: 'knowledge',
      contentId: 'shared-part', action: 'knowledge-completed', occurredAt: '2026-10-26T09:00:00.000Z',
    })
    const otherBand = createLearningEvent({
      accountId: 'student-a', gradeBand: 'grade3-4', source: 'knowledge',
      contentId: 'shared-part', action: 'knowledge-completed', occurredAt: '2026-10-26T09:00:00.000Z',
    })
    const otherAccount = createLearningEvent({
      accountId: 'student-b', gradeBand: 'grade1-2', source: 'knowledge',
      contentId: 'shared-part', action: 'knowledge-completed', occurredAt: '2026-10-26T09:00:00.000Z',
    })

    expect(new Set([first.id, otherBand.id, otherAccount.id]).size).toBe(3)
    expect(normalizeLearningEvents([first, otherBand, otherAccount], 'student-a')).toEqual([first, otherBand])
  })

  it('rejects hostile records, corrupt deltas, invalid dates and duplicate ids independently', () => {
    const valid = createLearningEvent({
      accountId: 'student-a', gradeBand: 'grade5-6', source: 'test',
      contentId: 'ael-1', action: 'test-passed', occurredAt: '2026-10-26T09:00:00.000Z',
    })
    const second = createLearningEvent({
      accountId: 'student-a', gradeBand: 'grade5-6', source: 'creative',
      contentId: 'work-1', action: 'work-completed', occurredAt: '2026-10-26T09:05:00.000Z',
    })
    const withSensitiveExtras = {
      ...valid,
      aiConversation: '不要持久化的对话原文',
      voice: 'base64-audio',
      password: 'sensitive',
    }

    const normalized = normalizeLearningEvents([
      withSensitiveExtras,
      { ...valid },
      { ...second, source: 'unknown' },
      { ...second, action: 'unknown' },
      { ...second, occurredAt: 'yesterday' },
      { ...second, dimensionDeltas: { ...second.dimensionDeltas, creativity: -1 } },
      { ...second, dimensionDeltas: { ...second.dimensionDeltas, creativity: Number.POSITIVE_INFINITY } },
      { ...second, dimensionDeltas: { curiosity: 2 } },
      second,
      null,
    ], 'student-a')

    expect(normalized).toEqual([valid, second])
    expect(normalized[0]).not.toHaveProperty('aiConversation')
    expect(normalized[0]).not.toHaveProperty('voice')
    expect(normalized[0]).not.toHaveProperty('password')
  })
})
