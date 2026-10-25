import { describe, expect, it } from 'vitest'
import { createEmptyLearningProgress } from './learning'
import {
  createDefaultLearningPlan,
  createGrade5LearningPlanSeed,
  getTaskCompletion,
  getTaskTiming,
  normalizeLearningPlan,
  type LearningPlanTask,
} from './learningPlan'

const now = new Date(2026, 9, 25, 12, 0)
const validTask: LearningPlanTask = {
  id: 'student-ael-4', grade: 'grade5', partId: 'ael-4', kind: 'knowledge',
  title: '第一次 AI 实验', date: '2026-10-26', time: '19:00', minutes: 20,
  order: 0, source: 'student', review: false,
  createdAt: '2026-10-25T04:00:00.000Z', updatedAt: '2026-10-25T04:00:00.000Z',
}

describe('learning plan domain', () => {
  it('normalizes saved tasks and removes invalid date/time/duration values', () => {
    const empty = { tasks: [], availability: [], lastAiSuggestionAt: null }
    const result = normalizeLearningPlan({ tasks: [
      validTask,
      { ...validTask, id: 'bad-duration', minutes: 0 },
      { ...validTask, id: 'bad-date', date: '2026-02-30' },
      { ...validTask, id: 'bad-time', time: '25:30' },
      { ...validTask, id: 'bad-grade', grade: 'grade8' },
      { ...validTask, id: 'wrong-course', partId: 'qmx-1' },
      { ...validTask, id: 'bad-order', order: -1 },
      { ...validTask, id: 'bad-source', source: 'robot' },
      { ...validTask, title: 'duplicate ID' },
    ] }, empty, now)
    expect(result.tasks).toEqual([validTask])
    expect(result.tasks[0]).not.toBe(validTask)
  })

  it('keeps only tasks from the active grade band', () => {
    const grade3Task = { ...validTask, id: 'grade3-cxd-4', grade: 'grade3' as const, partId: 'cxd-4' as const }
    const grade4Task = { ...validTask, id: 'grade4-cxd-5', grade: 'grade4' as const, partId: 'cxd-5' as const }
    const fallback = { tasks: [], availability: [], lastAiSuggestionAt: null }
    expect(normalizeLearningPlan({ tasks: [grade3Task, validTask, grade4Task] }, fallback, now, 'grade3').tasks)
      .toEqual([grade3Task, grade4Task])
  })

  it('derives completion from learning progress rather than a stored flag', () => {
    const progress = createEmptyLearningProgress()
    progress['grade5-6'].knowledgeCompleted = ['ael-4']
    const knowledge = { ...validTask, completed: false }
    const test = { ...validTask, id: 'test-ael-4', kind: 'test' as const, completed: true }
    expect(getTaskCompletion(knowledge, progress)).toBe('completed')
    expect(getTaskCompletion(test, progress)).toBe('pending')
    progress['grade5-6'].testsPassed.push('ael-4')
    expect(getTaskCompletion(test, progress)).toBe('completed')
  })

  it('classifies schedule time locally without conflating completion', () => {
    expect(getTaskTiming({ ...validTask, date: '2026-10-24' }, now)).toBe('overdue')
    expect(getTaskTiming({ ...validTask, date: '2026-10-25', time: '11:59' }, now)).toBe('overdue')
    expect(getTaskTiming({ ...validTask, date: '2026-10-25', time: '12:00' }, now)).toBe('today')
    expect(getTaskTiming({ ...validTask, date: '2026-10-26' }, now)).toBe('upcoming')
  })

  it('keeps the scheduled minute as today until the next minute begins', () => {
    const task = { ...validTask, date: '2026-10-25', time: '12:00' }
    expect(getTaskTiming(task, new Date(2026, 9, 25, 12, 0, 59, 999))).toBe('today')
    expect(getTaskTiming(task, new Date(2026, 9, 25, 12, 1, 0, 0))).toBe('overdue')
  })

  it('creates a seven-day local availability window and replaces invalid saved days', () => {
    const defaults = createDefaultLearningPlan(now)
    expect(defaults.availability.map((day) => day.date)).toEqual([
      '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28',
      '2026-10-29', '2026-10-30', '2026-10-31',
    ])
    expect(defaults.availability[0]).toEqual({
      date: '2026-10-25', enabled: true, startTime: '18:30', endTime: '19:30', maxMinutes: 30,
    })
    const saved = defaults.availability.map((day) => ({ ...day }))
    saved[1].maxMinutes = 0
    saved[2].startTime = '20:00'
    const normalized = normalizeLearningPlan({ availability: saved }, defaults, now)
    expect(normalized.availability).toEqual(defaults.availability)
    expect(normalized.availability[0]).not.toBe(defaults.availability[0])
  })

  it('seeds three real grade-five course tasks without legacy fake titles', () => {
    const tasks = createGrade5LearningPlanSeed(now)
    expect(tasks).toHaveLength(3)
    expect(tasks.map(({ partId, title }) => [partId, title])).toEqual([
      ['ael-4', '第一次 AI 实验'],
      ['ael-5', '给 AI 当评委'],
      ['ael-6', '生成式 AI 解密'],
    ])
    expect(tasks.every((task) => task.grade === 'grade5' && task.source === 'fallback')).toBe(true)
  })
})
