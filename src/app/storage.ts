import { COMPANION_CATALOG } from '../features/ai_companion/companionCatalog'
import { createDefaultLearningPlan, normalizeLearningPlan } from './learningPlan'
import { createEmptyLearningProgress, getPartIdsForBand, PRIMARY_GRADES, type CoursePartId, type GradeBand } from './learning'
import { appendLearningEvent, createLearningEvent, normalizeLearningEvents, type LearningEvent } from './learningEvents'
import { APP_STATE_VERSION, createDefaultState, type AppState, type CompanionCategory, type CompanionLoadout, type ConversationSummary, type DeviceInfo, type GrowthTitle, type GuardianInfo, type WrongAnswerRecord } from './model'
import type { PointTransaction, RewardKind } from './points'

export const LEGACY_STORAGE_KEY = 'student-app-state'
const MIGRATION_KEY = 'student-app-primary-v3-migrated'

type PersistedAppState = AppState

const PERSISTED_KEYS: Array<keyof PersistedAppState> = [
  'stateVersion', 'grade', 'isLoggedIn', 'learningProgress', 'learningPlan', 'transactions', 'processedRewardIds',
  'learningEvents', 'wrongAnswers', 'growthTitle',
  'aiPosition', 'companion', 'fontScale', 'nickname', 'avatar', 'likes', 'favorites', 'notifications',
  'accountId', 'passwordHint', 'lastPasswordChange', 'twoFactorEnabled', 'guardian', 'familyName',
  'devices', 'aiPersonality', 'voiceEnabled', 'autoListenEnabled', 'voiceMode',
  'voiceReplyMode', 'reduceMotion', 'saveHistory', 'aiMemoryEnabled', 'historyCount', 'conversationSummaries',
  'confirmDangerous', 'guardianApprove', 'safeMode',
  'soundEnabled', 'soundVolume', 'hapticEnabled', 'showLearningStats', 'allowFriendFind', 'dataCollection',
  'cameraPermission', 'micPermission', 'albumPermission', 'contentLevel', 'personalizedRec', 'storageUsed',
  'storageTotal', 'autoCleanDays',
]

export function loadState(): AppState {
  const fresh = createDefaultState()
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return fresh

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || (parsed.stateVersion !== 2 && parsed.stateVersion !== 3 && parsed.stateVersion !== 4 && parsed.stateVersion !== APP_STATE_VERSION)) {
      return migrateToPrimaryState(fresh)
    }

    const normalized = normalizePersistedState(parsed, fresh)
    if (parsed.stateVersion !== APP_STATE_VERSION) saveState(normalized)
    return normalized
  } catch {
    return migrateToPrimaryState(fresh)
  }
}

function migrateToPrimaryState(fresh: AppState) {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
  localStorage.setItem(MIGRATION_KEY, '1')
  saveState(fresh)
  return fresh
}

export function normalizePersistedState(parsed: Record<string, unknown>, fresh: AppState = createDefaultState()): AppState {
  const grade = oneOf(parsed.grade, PRIMARY_GRADES, fresh.grade)
  const now = new Date()
  const planFallback = grade === fresh.grade ? fresh.learningPlan : createDefaultLearningPlan(now, grade)
  const accountId = fresh.accountId
  const learningProgress = normalizeLearningProgress(parsed.learningProgress, fresh.learningProgress)
  const transactions = normalizeTransactions(parsed.transactions, fresh.transactions)
  const savedEvents = parsed.stateVersion === APP_STATE_VERSION
    ? normalizeLearningEvents(parsed.learningEvents, accountId)
    : []
  const learningEvents = backfillCourseEvents(savedEvents, learningProgress, transactions, accountId, now)
  return {
    stateVersion: APP_STATE_VERSION,
    grade,
    isLoggedIn: booleanValue(parsed.isLoggedIn, fresh.isLoggedIn),
    learningProgress,
    learningPlan: normalizeLearningPlan(parsed.stateVersion === 4 || parsed.stateVersion === APP_STATE_VERSION ? parsed.learningPlan : undefined, planFallback, now, grade),
    learningEvents,
    wrongAnswers: normalizeWrongAnswers(parsed.stateVersion === APP_STATE_VERSION ? parsed.wrongAnswers : undefined),
    growthTitle: normalizeGrowthTitle(parsed.stateVersion === APP_STATE_VERSION ? parsed.growthTitle : undefined),
    transactions,
    processedRewardIds: stringArray(parsed.processedRewardIds, fresh.processedRewardIds),
    aiPosition: normalizeAiPosition(parsed.aiPosition, fresh.aiPosition),
    companion: normalizePrimaryLoadout(parsed.companion, fresh.companion),
    fontScale: oneOf(parsed.fontScale, FONT_SCALES, fresh.fontScale),
    nickname: stringValue(parsed.nickname, fresh.nickname),
    avatar: nonNegativeInteger(parsed.avatar, fresh.avatar),
    likes: stringArray(parsed.likes, fresh.likes),
    favorites: stringArray(parsed.favorites, fresh.favorites),
    notifications: oneOf(parsed.notifications, NOTIFICATION_OPTIONS, fresh.notifications),
    accountId,
    passwordHint: stringValue(parsed.passwordHint, fresh.passwordHint),
    lastPasswordChange: stringValue(parsed.lastPasswordChange, fresh.lastPasswordChange),
    twoFactorEnabled: booleanValue(parsed.twoFactorEnabled, fresh.twoFactorEnabled),
    guardian: normalizeGuardian(parsed.guardian, fresh.guardian),
    familyName: stringValue(parsed.familyName, fresh.familyName),
    devices: normalizeDevices(parsed.devices, fresh.devices),
    aiPersonality: oneOf(parsed.aiPersonality, AI_PERSONALITIES, fresh.aiPersonality),
    voiceEnabled: booleanValue(parsed.voiceEnabled, fresh.voiceEnabled),
    autoListenEnabled: booleanValue(parsed.autoListenEnabled, fresh.autoListenEnabled),
    voiceMode: oneOf(parsed.voiceMode, VOICE_MODES, fresh.voiceMode),
    voiceReplyMode: oneOf(parsed.voiceReplyMode, VOICE_REPLY_MODES, fresh.voiceReplyMode),
    reduceMotion: booleanValue(parsed.reduceMotion, fresh.reduceMotion),
    saveHistory: booleanValue(parsed.saveHistory, fresh.saveHistory),
    aiMemoryEnabled: booleanValue(parsed.aiMemoryEnabled, fresh.aiMemoryEnabled),
    historyCount: nonNegativeInteger(parsed.historyCount, fresh.historyCount),
    conversationSummaries: normalizeConversationSummaries(parsed.conversationSummaries, fresh.conversationSummaries),
    confirmDangerous: booleanValue(parsed.confirmDangerous, fresh.confirmDangerous),
    guardianApprove: booleanValue(parsed.guardianApprove, fresh.guardianApprove),
    safeMode: oneOf(parsed.safeMode, SAFE_MODES, fresh.safeMode),
    soundEnabled: booleanValue(parsed.soundEnabled, fresh.soundEnabled),
    soundVolume: boundedNumber(parsed.soundVolume, fresh.soundVolume, 0, 100),
    hapticEnabled: booleanValue(parsed.hapticEnabled, fresh.hapticEnabled),
    showLearningStats: booleanValue(parsed.showLearningStats, fresh.showLearningStats),
    allowFriendFind: booleanValue(parsed.allowFriendFind, fresh.allowFriendFind),
    dataCollection: booleanValue(parsed.dataCollection, fresh.dataCollection),
    cameraPermission: oneOf(parsed.cameraPermission, PERMISSION_STATUSES, fresh.cameraPermission),
    micPermission: oneOf(parsed.micPermission, PERMISSION_STATUSES, fresh.micPermission),
    albumPermission: oneOf(parsed.albumPermission, PERMISSION_STATUSES, fresh.albumPermission),
    contentLevel: oneOf(parsed.contentLevel, CONTENT_LEVELS, fresh.contentLevel),
    personalizedRec: booleanValue(parsed.personalizedRec, fresh.personalizedRec),
    storageUsed: nonNegativeNumber(parsed.storageUsed, fresh.storageUsed),
    storageTotal: positiveNumber(parsed.storageTotal, fresh.storageTotal),
    autoCleanDays: positiveInteger(parsed.autoCleanDays, fresh.autoCleanDays),
  }
}

const FONT_SCALES = ['standard', 'large', 'xlarge'] as const
const NOTIFICATION_OPTIONS = ['important', 'all', 'off'] as const
const GUARDIAN_RELATIONSHIPS = ['father', 'mother', 'grandparent', 'other'] as const
const AI_PERSONALITIES = ['gentle', 'playful', 'serious', 'encouraging'] as const
const VOICE_MODES = ['warm', 'bright', 'calm'] as const
const VOICE_REPLY_MODES = ['always', 'voice-only', 'silent'] as const
const SAFE_MODES = ['strict', 'standard', 'relaxed'] as const
const PERMISSION_STATUSES = ['granted', 'denied', 'prompt'] as const
const CONTENT_LEVELS = ['general', 'teen', 'child'] as const
const REWARD_KINDS: RewardKind[] = ['knowledge', 'test', 'medal', 'band', 'starter', 'purchase']
const COMPANION_CATEGORIES: CompanionCategory[] = ['appearance', 'outfit', 'decoration']
const GRADE_BANDS: GradeBand[] = ['grade1-2', 'grade3-4', 'grade5-6']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return finiteNumber(value) && value >= min && value <= max ? value : fallback
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return finiteNumber(value) && value >= 0 ? value : fallback
}

function positiveNumber(value: unknown, fallback: number): number {
  return finiteNumber(value) && value > 0 ? value : fallback
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : fallback
}

function positiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0 ? value as number : fallback
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  return value.filter((item): item is string => typeof item === 'string')
}

function normalizeLearningProgress(value: unknown, fallback: AppState['learningProgress']): AppState['learningProgress'] {
  const progress = createEmptyLearningProgress()
  const storedProgress = isRecord(value) ? value : {}

  for (const band of ['grade1-2', 'grade3-4', 'grade5-6'] as const) {
    const validIds = new Set(getPartIdsForBand(band))
    const storedBand = isRecord(storedProgress[band]) ? storedProgress[band] : {}
    progress[band] = {
      knowledgeCompleted: normalizeCoursePartIds(storedBand.knowledgeCompleted, validIds, fallback[band].knowledgeCompleted),
      testsPassed: normalizeCoursePartIds(storedBand.testsPassed, validIds, fallback[band].testsPassed),
    }
  }

  return progress
}

function normalizeCoursePartIds(value: unknown, validIds: Set<CoursePartId>, fallback: CoursePartId[]): CoursePartId[] {
  if (!Array.isArray(value)) return [...fallback]
  return value.filter((id): id is CoursePartId => typeof id === 'string' && validIds.has(id as CoursePartId))
}

function backfillCourseEvents(
  events: LearningEvent[],
  progress: AppState['learningProgress'],
  transactions: PointTransaction[],
  accountId: string,
  now: Date,
): LearningEvent[] {
  let current = events
  for (const gradeBand of GRADE_BANDS) {
    for (const contentId of progress[gradeBand].knowledgeCompleted) {
      current = appendLearningEvent(current, createLearningEvent({
        accountId,
        gradeBand,
        source: 'knowledge',
        contentId,
        action: 'knowledge-completed',
        occurredAt: transactionDate(transactions, `knowledge:${contentId}`, now),
        migrationVersion: 1,
      }))
    }
    for (const contentId of progress[gradeBand].testsPassed) {
      current = appendLearningEvent(current, createLearningEvent({
        accountId,
        gradeBand,
        source: 'test',
        contentId,
        action: 'test-passed',
        occurredAt: transactionDate(transactions, `test:${contentId}`, now),
        migrationVersion: 1,
      }))
    }
  }
  return current
}

function transactionDate(transactions: PointTransaction[], eventId: string, fallback: Date): string {
  const occurredAt = transactions.find((transaction) => transaction.eventId === eventId)?.occurredAt
  if (occurredAt) {
    const timestamp = Date.parse(occurredAt)
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString()
  }
  return fallback.toISOString()
}

function normalizeWrongAnswers(value: unknown): WrongAnswerRecord[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const records: WrongAnswerRecord[] = []
  for (const candidate of value) {
    if (!isWrongAnswerRecord(candidate) || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    records.push({
      id: candidate.id,
      gradeBand: candidate.gradeBand,
      partId: candidate.partId,
      questionId: candidate.questionId,
      prompt: candidate.prompt,
      options: [...candidate.options],
      selectedIndex: candidate.selectedIndex,
      answerIndex: candidate.answerIndex,
      explanation: candidate.explanation,
      occurredAt: candidate.occurredAt,
      correctedAt: candidate.correctedAt,
    })
  }
  return records
}

function isWrongAnswerRecord(value: unknown): value is WrongAnswerRecord {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.gradeBand !== 'string'
    || !GRADE_BANDS.includes(value.gradeBand as GradeBand)
    || typeof value.partId !== 'string'
    || typeof value.questionId !== 'string'
    || typeof value.prompt !== 'string'
    || !Array.isArray(value.options)
    || value.options.length < 2
    || !value.options.every((option) => typeof option === 'string')
    || !Number.isInteger(value.selectedIndex)
    || !Number.isInteger(value.answerIndex)
    || (value.selectedIndex as number) < 0
    || (value.selectedIndex as number) >= value.options.length
    || (value.answerIndex as number) < 0
    || (value.answerIndex as number) >= value.options.length
    || value.selectedIndex === value.answerIndex
    || typeof value.explanation !== 'string'
    || typeof value.occurredAt !== 'string'
    || !isIsoDate(value.occurredAt)
    || (value.correctedAt !== null && (typeof value.correctedAt !== 'string' || !isIsoDate(value.correctedAt)))
  ) {
    return false
  }

  return new Set(getPartIdsForBand(value.gradeBand as GradeBand)).has(value.partId as CoursePartId)
}

function normalizeGrowthTitle(value: unknown): GrowthTitle | null {
  if (!isRecord(value)
    || typeof value.text !== 'string'
    || typeof value.description !== 'string'
    || typeof value.eventId !== 'string') {
    return null
  }
  return { text: value.text, description: value.description, eventId: value.eventId }
}

function isIsoDate(value: string): boolean {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function normalizeTransactions(value: unknown, fallback: PointTransaction[]): PointTransaction[] {
  if (!Array.isArray(value)) {
    return fallback.map((transaction) => ({ ...transaction }))
  }
  return value.filter(isPointTransaction).map((transaction) => ({
    id: transaction.id,
    eventId: transaction.eventId,
    kind: transaction.kind,
    title: transaction.title,
    amount: transaction.amount,
    occurredAt: transaction.occurredAt,
  }))
}

function isPointTransaction(value: unknown): value is PointTransaction {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.eventId === 'string'
    && typeof value.title === 'string'
    && typeof value.occurredAt === 'string'
    && finiteNumber(value.amount)
    && typeof value.kind === 'string'
    && REWARD_KINDS.includes(value.kind as RewardKind)
}

function normalizeAiPosition(value: unknown, fallback: AppState['aiPosition']): AppState['aiPosition'] {
  const stored = isRecord(value) ? value : {}
  return {
    x: boundedNumber(stored.x, fallback.x, 0, 1),
    y: boundedNumber(stored.y, fallback.y, 0, 1),
  }
}

function normalizeGuardian(value: unknown, fallback: GuardianInfo): GuardianInfo {
  const stored = isRecord(value) ? value : {}
  return {
    name: stringValue(stored.name, fallback.name),
    relationship: oneOf(stored.relationship, GUARDIAN_RELATIONSHIPS, fallback.relationship),
    phone: stringValue(stored.phone, fallback.phone),
    authorised: booleanValue(stored.authorised, fallback.authorised),
  }
}

function normalizeDevices(value: unknown, fallback: DeviceInfo[]): DeviceInfo[] {
  if (!Array.isArray(value)) {
    return fallback.map((device) => ({ ...device }))
  }
  return value.filter(isDeviceInfo).map((device) => ({
    name: device.name,
    lastActive: device.lastActive,
    current: device.current,
  }))
}

function isDeviceInfo(value: unknown): value is DeviceInfo {
  return isRecord(value)
    && typeof value.name === 'string'
    && typeof value.lastActive === 'string'
    && typeof value.current === 'boolean'
}

function normalizeConversationSummaries(value: unknown, fallback: ConversationSummary[]): ConversationSummary[] {
  const source = Array.isArray(value) ? value : fallback
  return source
    .filter(isConversationSummary)
    .map(({ id, topic, summary, occurredAt, messageCount }) => ({
      id,
      topic,
      summary,
      occurredAt,
      messageCount: Number.isInteger(messageCount) && (messageCount as number) > 0 ? messageCount as number : 1,
    }))
    .slice(-20)
}

function isConversationSummary(value: unknown): value is Omit<ConversationSummary, 'messageCount'> & { messageCount?: unknown } {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.topic === 'string'
    && typeof value.summary === 'string'
    && typeof value.occurredAt === 'string'
}

function normalizePrimaryLoadout(value: unknown, fallback: CompanionLoadout): CompanionLoadout {
  const stored = isRecord(value) ? value : {}
  const storedOwned = isRecord(stored.owned) ? stored.owned : {}
  const storedEquipped = isRecord(stored.equipped) ? stored.equipped : {}

  const primaryIds = Object.fromEntries(COMPANION_CATEGORIES.map((category) => [
    category,
    new Set(COMPANION_CATALOG
      .filter((item) => item.category === category)
      .map((item) => item.id)),
  ])) as Record<CompanionCategory, Set<string>>

  const storedPurchasedIds = COMPANION_CATEGORIES.flatMap((category) => {
    const candidate = storedOwned[category]
    return Array.isArray(candidate)
      ? candidate.filter((id): id is string => typeof id === 'string')
      : []
  })

  const owned = Object.fromEntries(COMPANION_CATEGORIES.map((category) => {
    const source = storedPurchasedIds.length > 0
      ? storedPurchasedIds
      : fallback.owned[category]
    const valid = [...new Set(source.filter((id) => primaryIds[category].has(id)))]
    return [category, category === 'appearance' ? ['momo', ...valid.filter((id) => id !== 'momo')] : valid]
  })) as CompanionLoadout['owned']

  const equipped = Object.fromEntries(COMPANION_CATEGORIES.map((category) => {
    const candidate = storedEquipped[category]
    if ((typeof candidate === 'string' || candidate === null) && candidate !== null && owned[category].includes(candidate)) {
      return [category, candidate]
    }
    const fallbackId = fallback.equipped[category]
    if (fallbackId && owned[category].includes(fallbackId)) return [category, fallbackId]
    return [category, category === 'appearance' ? 'momo' : null]
  })) as CompanionLoadout['equipped']

  return { owned, equipped, version: 1 }
}

export function toPersistedState(state: AppState): PersistedAppState {
  return Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]])) as PersistedAppState
}

export function saveState(state: AppState): void {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(toPersistedState(state)))
}
