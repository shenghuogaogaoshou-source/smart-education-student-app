import { describe, expect, it } from 'vitest'
import { createEmptyLearningProgress, getGradeBand, type BandProgress, type PrimaryGrade } from '../../app/learning'
import type { DailyAvailability, LearningPlanTask } from '../../app/learningPlan'
import { getCourseForGrade } from '../knowledge/courseCatalog'
import { buildFallbackPlan, getPlanCandidates, validatePlanTasks } from './learningPlanner'

const now = new Date(2026, 9, 25, 12)
const dates = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(2026, 9, 25 + index)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})
const availability: DailyAvailability[] = dates.map((date) => ({
  date, enabled: true, startTime: '18:30', endTime: '19:15', maxMinutes: 45,
}))

function task(overrides: Partial<LearningPlanTask> = {}): LearningPlanTask {
  return {
    id: 'one', grade: 'grade5', partId: 'ael-1', kind: 'knowledge', title: 'AI 系统拆解站',
    date: dates[0], time: '18:30', minutes: 15, order: 0, source: 'ai', review: false,
    createdAt: now.toISOString(), updatedAt: now.toISOString(), ...overrides,
  }
}

describe('real course learning planner', () => {
  it.each(['grade1', 'grade3', 'grade5'] as const)('uses only the active grade band for %s', (grade) => {
    const course = getCourseForGrade(grade)
    const candidates = getPlanCandidates(course, createEmptyLearningProgress()[getGradeBand(grade)])
    expect(candidates).toHaveLength(course.parts.length * 2)
    expect(new Set(candidates.map((item) => item.courseId))).toEqual(new Set([course.id]))
    expect(new Set(candidates.map((item) => item.partId))).toEqual(new Set(course.parts.map((part) => part.id)))
    expect(candidates.filter((item) => item.kind === 'test').map((item) => item.title)).toEqual(
      course.quizzes.map((quiz) => quiz.title),
    )
  })

  it('sorts unfinished knowledge, unlocked tests, then completed review', () => {
    const course = getCourseForGrade('grade5')
    const progress: BandProgress = { knowledgeCompleted: ['ael-1', 'ael-2'], testsPassed: ['ael-2'] }
    const candidates = getPlanCandidates(course, progress)
    expect(candidates[0]).toMatchObject({ partId: 'ael-3', kind: 'knowledge', review: false, suggestedMinutes: 15 })
    expect(candidates.findIndex((item) => item.partId === 'ael-1' && item.kind === 'test')).toBeLessThan(
      candidates.findIndex((item) => item.partId === 'ael-1' && item.kind === 'knowledge'),
    )
    expect(candidates.find((item) => item.partId === 'ael-1' && item.kind === 'test')).toMatchObject({
      review: false, unlocked: true, suggestedMinutes: 10,
    })
    expect(candidates.find((item) => item.partId === 'ael-3' && item.kind === 'test')).toMatchObject({
      review: false, unlocked: false,
    })
    expect(candidates.slice(-2).map(({ kind, review }) => [kind, review])).toEqual([
      ['knowledge', true], ['test', true],
    ])
  })

  it.each(['grade1', 'grade3', 'grade5'] as const)('places real %s tasks only inside daily availability and capacity', (grade: PrimaryGrade) => {
    const course = getCourseForGrade(grade)
    const plan = buildFallbackPlan({ grade, course, progress: createEmptyLearningProgress()[course.band], availability, now })
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.every((item) => course.parts.some((part) => part.id === item.partId))).toBe(true)
    for (const date of dates) {
      const daily = plan.filter((item) => item.date === date)
      expect(daily.reduce((total, item) => total + item.minutes, 0)).toBeLessThanOrEqual(45)
      expect(daily.every((item) => item.time >= '18:30' &&
        Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3)) + item.minutes <= 19 * 60 + 15)).toBe(true)
    }
    expect(plan[0]).toMatchObject({ date: dates[0], time: '18:30', kind: 'knowledge', source: 'fallback' })
  })

  it('places a locked test only after its unfinished knowledge', () => {
    const course = getCourseForGrade('grade5')
    const progress = {
      knowledgeCompleted: course.parts.slice(1).map((part) => part.id),
      testsPassed: course.parts.slice(1).map((part) => part.id),
    }
    const plan = buildFallbackPlan({ grade: 'grade5', course, progress, availability, now })
    const first = plan.findIndex((item) => item.partId === 'ael-1' && item.kind === 'knowledge')
    const test = plan.findIndex((item) => item.partId === 'ael-1' && item.kind === 'test')
    expect(first).toBe(0)
    expect(test).toBeGreaterThan(first)
  })

  it('never adds tasks without enabled days or enough time', () => {
    const course = getCourseForGrade('grade5')
    const progress = createEmptyLearningProgress()[course.band]
    expect(buildFallbackPlan({ grade: 'grade5', course, progress, availability: availability.map((day) => ({ ...day, enabled: false })), now })).toEqual([])
    expect(buildFallbackPlan({ grade: 'grade5', course, progress, availability: availability.map((day) => ({ ...day, maxMinutes: 5 })), now })).toEqual([])
  })

  it('filters unknown parts, kinds, grades, duplicates, dates and duration outside 5–90', () => {
    const candidates: unknown[] = [
      task(), task({ id: 'duplicate' }), task({ id: 'unknown', partId: 'ael-100' }),
      task({ id: 'wrong-grade', grade: 'grade1' }),
      task({ id: 'unknown-grade', grade: 'grade9' as PrimaryGrade, partId: 'ael-2' }),
      task({ id: 'wrong-kind', kind: 'video' as LearningPlanTask['kind'] }),
      task({ id: 'before', date: '2026-10-24' }), task({ id: 'after', date: '2026-11-01' }),
      task({ id: 'short', minutes: 4 }), task({ id: 'long', minutes: 91 }),
    ]
    expect(validatePlanTasks(candidates, { course: getCourseForGrade('grade5'), availability, now }).map(({ id }) => id)).toEqual(['one'])
  })

  it('filters disabled or unavailable times and enforces combined daily capacity', () => {
    const candidates = [
      task({ id: 'early', time: '18:29' }), task({ id: 'late', time: '19:01', minutes: 15 }),
      task({ id: 'valid' }), task({ id: 'over-capacity', partId: 'ael-2', time: '18:45', minutes: 40 }),
      task({ id: 'disabled', date: dates[1] }),
    ]
    const days = availability.map((day, index) => index === 1 ? { ...day, enabled: false } : day)
    expect(validatePlanTasks(candidates, { course: getCourseForGrade('grade5'), availability: days, now }).map(({ id }) => id)).toEqual(['valid'])
  })

  it('uses only the seven unique supplied dates, without expanding an incomplete calendar', () => {
    const days = [...availability.slice(0, 6), availability[0]]
    expect(validatePlanTasks([task({ id: 'seventh', date: dates[6] })], { course: getCourseForGrade('grade5'), availability: days, now })).toEqual([])
  })

  it('does not return a partial task as a valid LearningPlanTask', () => {
    const partial = { ...task(), source: undefined, createdAt: undefined }
    expect(validatePlanTasks([partial], { course: getCourseForGrade('grade5'), availability, now })).toEqual([])
  })
})
