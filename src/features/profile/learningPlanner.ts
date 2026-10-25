import { getGradeBand, isTestUnlocked, PRIMARY_GRADES, type BandProgress, type CourseId, type CoursePartId, type PrimaryGrade } from '../../app/learning'
import type { DailyAvailability, LearningPlanTask } from '../../app/learningPlan'
import type { CoursePackage } from '../knowledge/courseCatalog'

export type PlanCandidate = {
  courseId: CourseId
  partId: CoursePartId
  partNumber: number
  kind: 'knowledge' | 'test'
  title: string
  suggestedMinutes: number
  review: boolean
  unlocked: boolean
}

export type PlanContext = {
  course: CoursePackage
  availability: DailyAvailability[]
  now?: Date
}

export type FallbackPlanInput = PlanContext & {
  grade: PrimaryGrade
  progress: BandProgress
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sevenDayDates(now: Date): Set<string> {
  return new Set(Array.from({ length: 7 }, (_, index) =>
    dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + index))))
}

function minutesFromTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}

function timeFromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function availableDays({ availability, now = new Date() }: Pick<PlanContext, 'availability' | 'now'>): DailyAvailability[] {
  const window = sevenDayDates(now)
  const seen = new Set<string>()
  return availability.filter((day) => {
    const start = minutesFromTime(day.startTime)
    const end = minutesFromTime(day.endTime)
    if (!window.has(day.date) || seen.has(day.date) || !day.enabled || start === null || end === null || start >= end
      || !Number.isInteger(day.maxMinutes) || day.maxMinutes < 5 || day.maxMinutes > 180) return false
    seen.add(day.date)
    return true
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export function getPlanCandidates(course: CoursePackage, progress: BandProgress): PlanCandidate[] {
  const candidates = course.parts.flatMap((part): PlanCandidate[] => {
    const quiz = course.quizzes.find((item) => item.partId === part.id)
    return [
      {
        courseId: course.id, partId: part.id, partNumber: part.number, kind: 'knowledge', title: part.title,
        suggestedMinutes: 15, review: progress.knowledgeCompleted.includes(part.id), unlocked: true,
      },
      {
        courseId: course.id, partId: part.id, partNumber: part.number, kind: 'test', title: quiz?.title ?? part.title,
        suggestedMinutes: 10, review: progress.testsPassed.includes(part.id), unlocked: isTestUnlocked(progress, part.id),
      },
    ]
  })
  const rank = (item: PlanCandidate) => item.review ? 3
    : item.kind === 'knowledge' ? 0
      : item.unlocked ? 1 : 2
  return candidates.sort((a, b) => rank(a) - rank(b) || a.partNumber - b.partNumber
    || (a.kind === 'knowledge' ? -1 : 1))
}

export function buildFallbackPlan({ grade, course, progress, availability, now = new Date() }: FallbackPlanInput): LearningPlanTask[] {
  if (getGradeBand(grade) !== course.band) return []
  const days = availableDays({ availability, now })
  const candidates = getPlanCandidates(course, progress)
  const timestamp = now.toISOString()
  const tasks: LearningPlanTask[] = []
  let next = 0
  for (const day of days) {
    let cursor = minutesFromTime(day.startTime)!
    const end = minutesFromTime(day.endTime)!
    let used = 0
    while (next < candidates.length) {
      const candidate = candidates[next]
      if (used + candidate.suggestedMinutes > day.maxMinutes || cursor + candidate.suggestedMinutes > end) break
      tasks.push({
        id: `fallback-${day.date}-${candidate.partId}-${candidate.kind}`,
        grade, partId: candidate.partId, kind: candidate.kind, title: candidate.title,
        date: day.date, time: timeFromMinutes(cursor), minutes: candidate.suggestedMinutes,
        order: tasks.length, source: 'fallback', review: candidate.review,
        createdAt: timestamp, updatedAt: timestamp,
      })
      used += candidate.suggestedMinutes
      cursor += candidate.suggestedMinutes
      next += 1
    }
  }
  return tasks
}

export function validatePlanTasks(tasks: unknown, { course, availability, now = new Date() }: PlanContext): LearningPlanTask[] {
  if (!Array.isArray(tasks)) return []
  const days = new Map(availableDays({ availability, now }).map((day) => [day.date, day]))
  const partIds = new Set(course.parts.map((part) => part.id))
  const seen = new Set<string>()
  const totals = new Map<string, number>()
  const result: LearningPlanTask[] = []
  for (const value of tasks) {
    if (!value || typeof value !== 'object') continue
    const task = value as Partial<LearningPlanTask>
    const day = typeof task.date === 'string' ? days.get(task.date) : undefined
    if (!day || typeof task.grade !== 'string' || !PRIMARY_GRADES.includes(task.grade as PrimaryGrade)
      || getGradeBand(task.grade as PrimaryGrade) !== course.band
      || typeof task.partId !== 'string' || !partIds.has(task.partId as CoursePartId)
      || (task.kind !== 'knowledge' && task.kind !== 'test') || typeof task.id !== 'string' || !task.id.trim()
      || typeof task.title !== 'string' || !task.title.trim() || typeof task.time !== 'string'
      || !Number.isInteger(task.minutes) || task.minutes! < 5 || task.minutes! > 90
      || !Number.isInteger(task.order) || task.order! < 0
      || (task.source !== 'student' && task.source !== 'ai' && task.source !== 'fallback')
      || typeof task.review !== 'boolean'
      || typeof task.createdAt !== 'string' || !Number.isFinite(Date.parse(task.createdAt))
      || typeof task.updatedAt !== 'string' || !Number.isFinite(Date.parse(task.updatedAt))) continue
    const start = minutesFromTime(task.time)
    const dayStart = minutesFromTime(day.startTime)!
    const dayEnd = minutesFromTime(day.endTime)!
    const tuple = `${task.date}:${task.partId}:${task.kind}`
    if (start === null || start < dayStart || start + task.minutes! > dayEnd || seen.has(tuple)
      || (totals.get(day.date) ?? 0) + task.minutes! > day.maxMinutes) continue
    seen.add(tuple)
    totals.set(day.date, (totals.get(day.date) ?? 0) + task.minutes!)
    result.push(task as LearningPlanTask)
  }
  return result
}
