import { getGradeBand, getPartIdsForBand, PRIMARY_GRADES, type CoursePartId, type LearningProgress, type PrimaryGrade } from './learning'
import { getCourseForBand } from '../features/knowledge/courseCatalog'

export type LearningPlanTask = {
  id: string
  grade: PrimaryGrade
  partId: CoursePartId
  kind: 'knowledge' | 'test'
  title: string
  date: string
  time: string
  minutes: number
  order: number
  source: 'student' | 'ai' | 'fallback'
  review: boolean
  createdAt: string
  updatedAt: string
}

export type DailyAvailability = {
  date: string
  enabled: boolean
  startTime: string
  endTime: string
  maxMinutes: number
}

export type LearningPlanState = {
  tasks: LearningPlanTask[]
  availability: DailyAvailability[]
  lastAiSuggestionAt: string | null
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateAfter(now: Date, offset: number): string {
  return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validTask(value: unknown): value is LearningPlanTask {
  if (!isRecord(value)) return false
  if (typeof value.grade !== 'string' || !PRIMARY_GRADES.includes(value.grade as PrimaryGrade)) return false
  const band = getGradeBand(value.grade as PrimaryGrade)
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.partId === 'string' && getPartIdsForBand(band).includes(value.partId as CoursePartId)
    && (value.kind === 'knowledge' || value.kind === 'test')
    && typeof value.title === 'string' && value.title.trim().length > 0
    && validDate(value.date) && validTime(value.time)
    && Number.isInteger(value.minutes) && (value.minutes as number) >= 5 && (value.minutes as number) <= 90
    && Number.isInteger(value.order) && (value.order as number) >= 0
    && (value.source === 'student' || value.source === 'ai' || value.source === 'fallback')
    && typeof value.review === 'boolean'
    && validTimestamp(value.createdAt) && validTimestamp(value.updatedAt)
}

function validAvailability(value: unknown, expectedDate: string): value is DailyAvailability {
  return isRecord(value) && value.date === expectedDate
    && typeof value.enabled === 'boolean'
    && validTime(value.startTime) && validTime(value.endTime)
    && value.startTime < value.endTime
    && Number.isInteger(value.maxMinutes) && (value.maxMinutes as number) >= 5 && (value.maxMinutes as number) <= 180
}

export function createLearningPlanSeed(grade: PrimaryGrade, now: Date = new Date()): LearningPlanTask[] {
  const parts = getCourseForBand(getGradeBand(grade)).parts
  const timestamp = now.toISOString()
  return [4, 5, 6].map((number, index) => {
    const part = parts[number - 1]
    return {
      id: `seed-${grade}-${part.id}`,
      grade,
      partId: part.id,
      kind: 'knowledge',
      title: part.title,
      date: dateAfter(now, index),
      time: '19:00',
      minutes: 20,
      order: index,
      source: 'fallback',
      review: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
}

export function createGrade5LearningPlanSeed(now: Date = new Date()): LearningPlanTask[] {
  return createLearningPlanSeed('grade5', now)
}

export function createDefaultLearningPlan(now: Date = new Date(), grade: PrimaryGrade = 'grade5'): LearningPlanState {
  return {
    tasks: createLearningPlanSeed(grade, now),
    availability: Array.from({ length: 7 }, (_, index) => ({
      date: dateAfter(now, index), enabled: true, startTime: '18:30', endTime: '19:30', maxMinutes: 30,
    })),
    lastAiSuggestionAt: null,
  }
}

export function normalizeLearningPlan(value: unknown, fallback: LearningPlanState, now: Date = new Date(), accountGrade: PrimaryGrade = 'grade5'): LearningPlanState {
  const stored = isRecord(value) ? value : {}
  const source = Array.isArray(stored.tasks) ? stored.tasks : fallback.tasks
  const ids = new Set<string>()
  const tasks: LearningPlanTask[] = []
  for (const candidate of source) {
    if (!validTask(candidate) || getGradeBand(candidate.grade) !== getGradeBand(accountGrade) || ids.has(candidate.id)) continue
    ids.add(candidate.id)
    const { id, grade, partId, kind, title, date, time, minutes, order, source, review, createdAt, updatedAt } = candidate
    tasks.push({ id, grade, partId, kind, title, date, time, minutes, order, source, review, createdAt, updatedAt })
  }

  const storedDays = Array.isArray(stored.availability) ? stored.availability : []
  const fallbackDays = fallback.availability
  const availability = Array.from({ length: 7 }, (_, index): DailyAvailability => {
    const date = dateAfter(now, index)
    const day = storedDays.find((item) => isRecord(item) && item.date === date)
    const fallbackDay = fallbackDays.find((item) => item.date === date)
    const selected = validAvailability(day, date) ? day
      : validAvailability(fallbackDay, date) ? fallbackDay
        : { date, enabled: true, startTime: '18:30', endTime: '19:30', maxMinutes: 30 }
    return { ...selected }
  })

  return {
    tasks,
    availability,
    lastAiSuggestionAt: stored.lastAiSuggestionAt === null || validTimestamp(stored.lastAiSuggestionAt)
      ? stored.lastAiSuggestionAt as string | null
      : fallback.lastAiSuggestionAt,
  }
}

export function getTaskCompletion(task: LearningPlanTask, progress: LearningProgress): 'completed' | 'pending' {
  const bandProgress = progress[getGradeBand(task.grade)]
  const completed = task.kind === 'knowledge' ? bandProgress.knowledgeCompleted : bandProgress.testsPassed
  return completed.includes(task.partId) ? 'completed' : 'pending'
}

export function getTaskTiming(task: LearningPlanTask, now: Date = new Date()): 'overdue' | 'today' | 'upcoming' {
  const [year, month, day] = task.date.split('-').map(Number)
  const [hour, minute] = task.time.split(':').map(Number)
  const planned = new Date(year, month - 1, day, hour, minute)
  const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())
  if (planned.getTime() < currentMinute.getTime()) return 'overdue'
  return task.date === localDate(now) ? 'today' : 'upcoming'
}
