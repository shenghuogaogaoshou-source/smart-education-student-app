import type { GradeBand } from './learning'

export type GrowthDimension = 'curiosity' | 'knowledge' | 'problemSolving' | 'creativity' | 'planning'
export type GrowthScores = Record<GrowthDimension, number>
export type LearningEventAction = 'knowledge-completed' | 'test-passed' | 'correction-completed' | 'work-completed' | 'schedule-completed'
export type LearningEventSource = 'knowledge' | 'test' | 'correction' | 'creative' | 'schedule'

export type LearningEvent = {
  id: string
  accountId: string
  gradeBand: GradeBand
  source: LearningEventSource
  contentId: string
  action: LearningEventAction
  occurredAt: string
  dimensionDeltas: GrowthScores
  migrationVersion?: 1
}

export const LEARNING_EVENT_DELTAS: Record<LearningEventAction, GrowthScores> = {
  'knowledge-completed': { curiosity: 2, knowledge: 4, problemSolving: 0, creativity: 0, planning: 0 },
  'test-passed': { curiosity: 0, knowledge: 2, problemSolving: 4, creativity: 0, planning: 0 },
  'correction-completed': { curiosity: 0, knowledge: 0, problemSolving: 2, creativity: 0, planning: 2 },
  'work-completed': { curiosity: 2, knowledge: 0, problemSolving: 0, creativity: 4, planning: 0 },
  'schedule-completed': { curiosity: 0, knowledge: 0, problemSolving: 0, creativity: 0, planning: 3 },
}

const GRADE_BANDS: GradeBand[] = ['grade1-2', 'grade3-4', 'grade5-6']
const ACTIONS = Object.keys(LEARNING_EVENT_DELTAS) as LearningEventAction[]
const SOURCES: LearningEventSource[] = ['knowledge', 'test', 'correction', 'creative', 'schedule']
const DIMENSIONS: GrowthDimension[] = ['curiosity', 'knowledge', 'problemSolving', 'creativity', 'planning']
const SOURCE_BY_ACTION: Record<LearningEventAction, LearningEventSource> = {
  'knowledge-completed': 'knowledge',
  'test-passed': 'test',
  'correction-completed': 'correction',
  'work-completed': 'creative',
  'schedule-completed': 'schedule',
}

type LearningEventKeyInput = Pick<LearningEvent, 'accountId' | 'gradeBand' | 'action' | 'contentId'>
type CreateLearningEventInput = Omit<LearningEvent, 'id' | 'dimensionDeltas'>

export function eventKey(input: LearningEventKeyInput): string {
  return `${input.accountId}:${input.gradeBand}:${input.action}:${input.contentId}`
}

export function createLearningEvent(input: CreateLearningEventInput): LearningEvent {
  return {
    id: eventKey(input),
    accountId: input.accountId,
    gradeBand: input.gradeBand,
    source: input.source,
    contentId: input.contentId,
    action: input.action,
    occurredAt: input.occurredAt,
    dimensionDeltas: { ...LEARNING_EVENT_DELTAS[input.action] },
    ...(input.migrationVersion === 1 ? { migrationVersion: 1 as const } : {}),
  }
}

export function appendLearningEvent(events: LearningEvent[], event: LearningEvent): LearningEvent[] {
  return events.some(({ id }) => id === event.id) ? events : [...events, event]
}

export function normalizeLearningEvents(value: unknown, accountId: string): LearningEvent[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const events: LearningEvent[] = []
  for (const candidate of value) {
    if (!isLearningEvent(candidate, accountId) || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    events.push({
      id: candidate.id,
      accountId: candidate.accountId,
      gradeBand: candidate.gradeBand,
      source: candidate.source,
      contentId: candidate.contentId,
      action: candidate.action,
      occurredAt: candidate.occurredAt,
      dimensionDeltas: { ...candidate.dimensionDeltas },
      ...(candidate.migrationVersion === 1 ? { migrationVersion: 1 as const } : {}),
    })
  }
  return events
}

function isLearningEvent(value: unknown, accountId: string): value is LearningEvent {
  if (!isRecord(value)
    || value.accountId !== accountId
    || typeof value.accountId !== 'string'
    || typeof value.contentId !== 'string'
    || value.contentId.length === 0
    || typeof value.gradeBand !== 'string'
    || !GRADE_BANDS.includes(value.gradeBand as GradeBand)
    || typeof value.action !== 'string'
    || !ACTIONS.includes(value.action as LearningEventAction)
    || typeof value.source !== 'string'
    || !SOURCES.includes(value.source as LearningEventSource)
    || SOURCE_BY_ACTION[value.action as LearningEventAction] !== value.source
    || typeof value.occurredAt !== 'string'
    || !isIsoDate(value.occurredAt)
    || typeof value.id !== 'string'
    || (value.migrationVersion !== undefined && value.migrationVersion !== 1)
    || !hasValidDeltas(value.dimensionDeltas, value.action as LearningEventAction)) {
    return false
  }

  return value.id === eventKey({
    accountId: value.accountId,
    gradeBand: value.gradeBand as GradeBand,
    action: value.action as LearningEventAction,
    contentId: value.contentId,
  })
}

function hasValidDeltas(value: unknown, action: LearningEventAction): value is GrowthScores {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== DIMENSIONS.length || !DIMENSIONS.every((dimension) => keys.includes(dimension))) return false

  const expected = LEARNING_EVENT_DELTAS[action]
  return DIMENSIONS.every((dimension) => {
    const delta = value[dimension]
    return typeof delta === 'number' && Number.isFinite(delta) && delta >= 0 && delta === expected[dimension]
  })
}

function isIsoDate(value: string): boolean {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
