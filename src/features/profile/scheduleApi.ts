import {
  PRIMARY_GRADES,
  type BandProgress,
  type CoursePartId,
  type GradeBand,
  type PrimaryGrade,
} from '../../app/learning'
import type { DailyAvailability, LearningPlanTask } from '../../app/learningPlan'

type CatalogKind = 'knowledge' | 'test'

export type ScheduleCatalogItem = {
  partId: CoursePartId
  kind: CatalogKind
  title: string
  suggestedMinutes: number
}

export type ScheduleWrongQuestionSummary =
  | string
  | { partId: CoursePartId; kind: CatalogKind }

export type ScheduleSuggestionRequest = {
  grade: PrimaryGrade
  gradeBand: GradeBand
  availability: DailyAvailability[]
  catalog: ScheduleCatalogItem[]
  progress: BandProgress
  currentTasks: LearningPlanTask[]
  wrongQuestionSummaries: ScheduleWrongQuestionSummary[]
}

export type ScheduleSuggestionResult = {
  tasks: LearningPlanTask[]
  weekSummary: string
  reasons: Record<string, string>
}

export class ScheduleSuggestionError extends Error {
  readonly status?: number
  readonly code: string

  constructor(status: number | undefined, code: string) {
    super(code)
    this.name = 'ScheduleSuggestionError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseTask(value: unknown, request: ScheduleSuggestionRequest): LearningPlanTask {
  if (!isRecord(value)
    || typeof value.id !== 'string' || !/^[A-Za-z0-9:_-]{1,120}$/.test(value.id)
    || value.grade !== request.grade
    || typeof value.partId !== 'string'
    || (value.kind !== 'knowledge' && value.kind !== 'test')
    || typeof value.date !== 'string' || !request.availability.some((day) => day.date === value.date)
    || typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    || !Number.isInteger(value.minutes) || (value.minutes as number) < 5 || (value.minutes as number) > 90
    || !Number.isInteger(value.order) || (value.order as number) < 0
    || value.source !== 'ai'
    || !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt)) {
    throw new ScheduleSuggestionError(502, 'invalid_response')
  }
  const catalogItem = request.catalog.find((item) => item.partId === value.partId && item.kind === value.kind)
  if (!catalogItem || typeof catalogItem.title !== 'string' || !catalogItem.title.trim()) {
    throw new ScheduleSuggestionError(502, 'invalid_response')
  }
  const completed = value.kind === 'knowledge'
    ? request.progress.knowledgeCompleted.includes(catalogItem.partId)
    : request.progress.testsPassed.includes(catalogItem.partId)
  return {
    id: value.id,
    grade: value.grade as PrimaryGrade,
    partId: value.partId as CoursePartId,
    kind: value.kind,
    title: catalogItem.title,
    date: value.date,
    time: value.time,
    minutes: value.minutes as number,
    order: value.order as number,
    source: 'ai',
    review: completed,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function parseScheduleSuggestion(
  value: unknown,
  request: ScheduleSuggestionRequest,
): ScheduleSuggestionResult {
  if (!isRecord(value) || !Array.isArray(value.tasks) || !value.tasks.length
    || typeof value.weekSummary !== 'string' || !value.weekSummary.trim()
    || !isRecord(value.reasons)) {
    throw new ScheduleSuggestionError(502, 'invalid_response')
  }
  const tasks = value.tasks.map((task) => parseTask(task, request))
  const ids = new Set<string>()
  const tuples = new Set<string>()
  const reasons = Object.create(null) as Record<string, string>
  for (const task of tasks) {
    const tuple = `${task.date}:${task.partId}:${task.kind}`
    if (ids.has(task.id) || tuples.has(tuple)) {
      throw new ScheduleSuggestionError(502, 'invalid_response')
    }
    ids.add(task.id)
    tuples.add(tuple)
    const reason = value.reasons[task.id]
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 120) {
      throw new ScheduleSuggestionError(502, 'invalid_response')
    }
    reasons[task.id] = reason.trim()
  }
  return {
    tasks,
    weekSummary: value.weekSummary.trim().slice(0, 120),
    reasons,
  }
}

export async function requestScheduleSuggestion(
  request: ScheduleSuggestionRequest,
  signal?: AbortSignal,
): Promise<ScheduleSuggestionResult> {
  if (!PRIMARY_GRADES.includes(request.grade)) throw new ScheduleSuggestionError(400, 'invalid_request')
  const response = await fetch('/api/companion/schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) {
    let code = 'provider_error'
    try {
      const body = await response.json() as unknown
      if (isRecord(body) && typeof body.error === 'string' && /^[a-z_]{1,48}$/.test(body.error)) code = body.error
    } catch {
      // Never expose or copy an arbitrary upstream body.
    }
    throw new ScheduleSuggestionError(response.status, code)
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ScheduleSuggestionError(response.status, 'invalid_response')
  }
  return parseScheduleSuggestion(body, request)
}
