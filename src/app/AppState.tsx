import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react'
import { getGradeBand, getPartIdsForBand, type CoursePartId, type PrimaryGrade } from './learning'
import { defaultState, type AiPersonality, type AiPosition, type AppState, type CompanionCategory, type CompanionLoadout, type ContentLevel, type FontScale, type GuardianInfo, type PermissionStatus, type SafeMode, type VoiceMode, type VoiceReplyMode, type WrongAnswerRecord } from './model'
import { getTaskCompletion, normalizeLearningPlan, type DailyAvailability, type LearningPlanTask } from './learningPlan'
import { applyTransactionOnce, buildProgressRewardTransactions, getPointsBalance } from './points'
import { loadAccountState, peekAccountCompanion, saveAccountState } from './companionAccountRepository'
import { appendLearningEvent, createLearningEvent } from './learningEvents'
import type { LearningEvent } from './learningEvents'
import { useOptionalSessionCredential } from '../features/auth/sessionCredential'
import { chooseNextGrowthTitle } from '../features/profile/growthProfile'
import type { QuizResult, QuizWrongAnswer } from '../features/test/QuizModal'

type Action =
  | { type: 'set-grade'; grade: PrimaryGrade }
  | { type: 'complete-knowledge'; partId: CoursePartId; title: string; occurredAt: string }
  | { type: 'pass-test'; partId: CoursePartId; title: string; occurredAt: string }
  | { type: 'submit-quiz-result'; partId: CoursePartId; title: string; occurredAt: string; result: QuizResult }
  | { type: 'complete-correction'; wrongAnswerId: string; occurredAt: string }
  | { type: 'record-creative-work'; workId: string; occurredAt: string }
  | { type: 'replace-learning-plan'; tasks: LearningPlanTask[]; source: 'student' | 'ai' | 'fallback' }
  | { type: 'upsert-plan-task'; task: LearningPlanTask }
  | { type: 'remove-plan-task'; id: string }
  | { type: 'reorder-plan-tasks'; date: string; ids: string[] }
  | { type: 'set-plan-availability'; availability: DailyAvailability[] }
  | { type: 'replace-account'; state: AppState }
  | { type: 'logout' }
  | { type: 'set-font-scale'; scale: FontScale }
  | { type: 'set-profile'; nickname: string; avatar: number }
  | { type: 'toggle-like'; id: string }
  | { type: 'toggle-favorite'; id: string }
  | { type: 'set-notifications'; value: AppState['notifications'] }
  | { type: 'set-ai-position'; position: AiPosition }
  | { type: 'reset-ai-position' }
  | { type: 'set-two-factor'; enabled: boolean }
  | { type: 'update-password'; lastChange: string }
  | { type: 'set-guardian'; guardian: GuardianInfo }
  | { type: 'set-family-name'; name: string }
  | { type: 'remove-device'; index: number }
  // AI 伙伴
  | { type: 'set-ai-personality'; personality: AiPersonality }
  | { type: 'purchase-companion-item'; category: CompanionCategory; id: string; price: number; name: string; occurredAt: string }
  | { type: 'equip-companion-item'; category: CompanionCategory; id: string }
  | { type: 'unequip-companion-item'; category: Exclude<CompanionCategory, 'appearance'> }
  | { type: 'set-voice-enabled'; enabled: boolean }
  | { type: 'set-auto-listen'; enabled: boolean }
  | { type: 'set-voice-mode'; mode: VoiceMode }
  | { type: 'set-voice-reply-mode'; mode: VoiceReplyMode }
  | { type: 'set-save-history'; enabled: boolean }
  | { type: 'set-ai-memory'; enabled: boolean }
  | { type: 'clear-history' }
  | { type: 'set-confirm-dangerous'; enabled: boolean }
  | { type: 'set-guardian-approve'; enabled: boolean }
  | { type: 'set-safe-mode'; mode: SafeMode }
  // 声音与触感
  | { type: 'set-sound-enabled'; enabled: boolean }
  | { type: 'set-sound-volume'; volume: number }
  | { type: 'set-haptic-enabled'; enabled: boolean }
  // 隐私
  | { type: 'set-show-stats'; enabled: boolean }
  | { type: 'set-friend-find'; enabled: boolean }
  | { type: 'set-data-collection'; enabled: boolean }
  // 权限
  | { type: 'set-camera-permission'; status: PermissionStatus }
  | { type: 'set-mic-permission'; status: PermissionStatus }
  | { type: 'set-album-permission'; status: PermissionStatus }
  // 内容保护
  | { type: 'set-content-level'; level: ContentLevel }
  | { type: 'set-personalized-rec'; enabled: boolean }
  // 存储
  | { type: 'set-auto-clean'; days: number }
  | { type: 'clear-cache' }

function toggle(items: string[], id: string) {
  return items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
}

function applyLearningEvent(state: AppState, event: LearningEvent): AppState {
  const learningEvents = appendLearningEvent(state.learningEvents, event)
  if (learningEvents === state.learningEvents) return state
  return {
    ...state,
    learningEvents,
    growthTitle: chooseNextGrowthTitle(event, state.growthTitle),
  }
}

function updateProgress(
  state: AppState,
  action: Extract<Action, { type: 'complete-knowledge' | 'pass-test' }>,
) {
  const band = getGradeBand(state.grade)
  const before = state.learningProgress[band]
  const field = action.type === 'complete-knowledge' ? 'knowledgeCompleted' : 'testsPassed'
  if (before[field].includes(action.partId)) return state
  if (action.type === 'pass-test' && !before.knowledgeCompleted.includes(action.partId)) return state

  const after = { ...before, [field]: [...before[field], action.partId] }
  const pendingPlanTasks = state.learningPlan.tasks.filter((task) => (
    task.partId === action.partId
    && task.kind === (action.type === 'complete-knowledge' ? 'knowledge' : 'test')
    && getTaskCompletion(task, state.learningProgress) === 'pending'
  ))
  const completionEvent = action.type === 'complete-knowledge'
    ? createLearningEvent({
        accountId: state.accountId,
        gradeBand: band,
        source: 'knowledge',
        contentId: action.partId,
        action: 'knowledge-completed',
        occurredAt: action.occurredAt,
      })
    : createLearningEvent({
        accountId: state.accountId,
        gradeBand: band,
        source: 'test',
        contentId: action.partId,
        action: 'test-passed',
        occurredAt: action.occurredAt,
      })
  let next = {
    ...state,
    learningProgress: { ...state.learningProgress, [band]: after },
  }
  for (const transaction of buildProgressRewardTransactions(
    before,
    after,
    band,
    getPartIdsForBand(band),
    action.occurredAt,
  )) {
    next = applyTransactionOnce(next, {
      ...transaction,
      title: transaction.kind === 'knowledge'
        ? `完成知识：${action.title}`
        : transaction.kind === 'test'
          ? `通过测试：${action.title}`
          : transaction.title,
    })
  }
  next = applyLearningEvent(next, completionEvent)
  for (const task of pendingPlanTasks) {
    next = applyLearningEvent(next, createLearningEvent({
      accountId: state.accountId,
      gradeBand: band,
      source: 'schedule',
      contentId: task.id,
      action: 'schedule-completed',
      occurredAt: action.occurredAt,
    }))
  }
  return next
}

function submitQuizResult(
  state: AppState,
  action: Extract<Action, { type: 'submit-quiz-result' }>,
) {
  const band = getGradeBand(state.grade)
  if (!state.learningProgress[band].knowledgeCompleted.includes(action.partId)) return state

  const withWrongAnswers = upsertWrongAnswers(state, action.result.wrongAnswers, band, action.partId, action.occurredAt)
  const passed = action.result.total > 0 && action.result.score / action.result.total >= 0.6
  if (!passed) return withWrongAnswers
  return updateProgress(withWrongAnswers, {
    type: 'pass-test',
    partId: action.partId,
    title: action.title,
    occurredAt: action.occurredAt,
  })
}

function upsertWrongAnswers(
  state: AppState,
  answers: QuizWrongAnswer[],
  band: ReturnType<typeof getGradeBand>,
  partId: CoursePartId,
  occurredAt: string,
): AppState {
  if (answers.length === 0) return state

  const records = new Map(state.wrongAnswers.map((record) => [record.id, record]))
  for (const answer of answers) {
    if (!isQuizWrongAnswer(answer)) continue
    const id = `${band}:${partId}:${answer.questionId}`
    const record: WrongAnswerRecord = {
      id,
      gradeBand: band,
      partId,
      questionId: answer.questionId,
      prompt: answer.prompt,
      options: [...answer.options],
      selectedIndex: answer.selectedIndex,
      answerIndex: answer.answerIndex,
      explanation: answer.explanation,
      occurredAt,
      correctedAt: null,
    }
    records.set(id, record)
  }
  return { ...state, wrongAnswers: [...records.values()] }
}

function isQuizWrongAnswer(answer: QuizWrongAnswer): boolean {
  return typeof answer.questionId === 'string'
    && answer.questionId.length > 0
    && typeof answer.prompt === 'string'
    && Array.isArray(answer.options)
    && answer.options.every((option) => typeof option === 'string')
    && Number.isInteger(answer.selectedIndex)
    && Number.isInteger(answer.answerIndex)
    && answer.selectedIndex !== answer.answerIndex
    && answer.selectedIndex >= 0
    && answer.selectedIndex < answer.options.length
    && answer.answerIndex >= 0
    && answer.answerIndex < answer.options.length
    && typeof answer.explanation === 'string'
}

function completeCorrection(
  state: AppState,
  action: Extract<Action, { type: 'complete-correction' }>,
): AppState {
  const wrongAnswer = state.wrongAnswers.find((record) => record.id === action.wrongAnswerId)
  if (!wrongAnswer || wrongAnswer.correctedAt) return state

  return applyLearningEvent({
    ...state,
    wrongAnswers: state.wrongAnswers.map((record) => (
      record.id === wrongAnswer.id ? { ...record, correctedAt: action.occurredAt } : record
    )),
  }, createLearningEvent({
    accountId: state.accountId,
    gradeBand: wrongAnswer.gradeBand,
    source: 'correction',
    contentId: wrongAnswer.id,
    action: 'correction-completed',
    occurredAt: action.occurredAt,
  }))
}

function recordCreativeWork(
  state: AppState,
  action: Extract<Action, { type: 'record-creative-work' }>,
): AppState {
  const event = createLearningEvent({
    accountId: state.accountId,
    gradeBand: getGradeBand(state.grade),
    source: 'creative',
    contentId: action.workId,
    action: 'work-completed',
    occurredAt: action.occurredAt,
  })
  return applyLearningEvent(state, event)
}

function purchase(
  state: AppState,
  action: Extract<Action, { type: 'purchase-companion-item' }>,
) {
  if (state.companion.owned[action.category].includes(action.id)) return state
  if (!Number.isFinite(action.price) || action.price <= 0 || getPointsBalance(state.transactions) < action.price) return state

  const transaction = {
    id: `purchase:${action.id}`,
    eventId: `purchase:${action.id}`,
    kind: 'purchase' as const,
    title: `积分商城购买：${action.name}`,
    amount: -action.price,
    occurredAt: action.occurredAt,
  }
  const debited = applyTransactionOnce(state, transaction)
  if (debited === state) return state

  return {
    ...debited,
    companion: {
      ...debited.companion,
      owned: {
        ...debited.companion.owned,
        [action.category]: [...debited.companion.owned[action.category], action.id],
      },
    },
  }
}

function currentPlan(state: AppState, now: Date) {
  return normalizeLearningPlan(state.learningPlan, state.learningPlan, now, state.grade)
}

function normalizedPlan(
  state: AppState,
  tasks: LearningPlanTask[],
  availability: DailyAvailability[],
  now: Date,
) {
  return normalizeLearningPlan({ ...state.learningPlan, tasks, availability }, state.learningPlan, now, state.grade)
}

function replaceLearningPlan(
  state: AppState,
  action: Extract<Action, { type: 'replace-learning-plan' }>,
) {
  const now = new Date()
  const refreshed = currentPlan(state, now)
  const activeDates = new Set(refreshed.availability.map((day) => day.date))
  const history = refreshed.tasks.filter((task) =>
    !activeDates.has(task.date) && getTaskCompletion(task, state.learningProgress) === 'completed')
  const currentById = new Map(
    refreshed.tasks
      .filter((task) => activeDates.has(task.date))
      .map((task) => [task.id, task]),
  )
  const replacement = action.tasks
    .filter((task) => activeDates.has(task.date))
    .map((task) => ({ ...task, source: currentById.get(task.id)?.source ?? action.source }))
  return {
    ...state,
    learningPlan: normalizedPlan(state, [...history, ...replacement], refreshed.availability, now),
  }
}

function upsertPlanTask(
  state: AppState,
  action: Extract<Action, { type: 'upsert-plan-task' }>,
) {
  const now = new Date()
  const refreshed = currentPlan(state, now)
  const activeDates = new Set(refreshed.availability.map((day) => day.date))
  if (!activeDates.has(action.task.date)) return state
  const tasks = [
    ...refreshed.tasks.filter((task) => task.id !== action.task.id || !activeDates.has(task.date)),
    action.task,
  ]
  return {
    ...state,
    learningPlan: normalizedPlan(state, tasks, refreshed.availability, now),
  }
}

function reorderPlanTasks(
  state: AppState,
  action: Extract<Action, { type: 'reorder-plan-tasks' }>,
) {
  const now = new Date()
  const refreshed = currentPlan(state, now)
  if (!refreshed.availability.some((day) => day.date === action.date)) return state

  const dailyTasks = refreshed.tasks
    .filter((task) => task.date === action.date)
    .sort((left, right) => left.order - right.order)
  const byId = new Map(dailyTasks.map((task) => [task.id, task]))
  const orderedIds = [...new Set(action.ids)].filter((id) => byId.has(id))
  for (const task of dailyTasks) {
    if (!orderedIds.includes(task.id)) orderedIds.push(task.id)
  }
  const orderedTasks = orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index }))
  let orderedIndex = 0
  const tasks = refreshed.tasks.map((task) => task.date === action.date
    ? orderedTasks[orderedIndex++]
    : task)
  return {
    ...state,
    learningPlan: normalizedPlan(state, tasks, refreshed.availability, now),
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-grade': return { ...state, grade: action.grade }
    case 'complete-knowledge':
    case 'pass-test': return updateProgress(state, action)
    case 'submit-quiz-result': return submitQuizResult(state, action)
    case 'complete-correction': return completeCorrection(state, action)
    case 'record-creative-work': return recordCreativeWork(state, action)
    case 'replace-learning-plan': return replaceLearningPlan(state, action)
    case 'upsert-plan-task': return upsertPlanTask(state, action)
    case 'remove-plan-task': {
      const now = new Date()
      const refreshed = currentPlan(state, now)
      return {
        ...state,
        learningPlan: normalizedPlan(
          state,
          refreshed.tasks.filter((task) => task.id !== action.id),
          refreshed.availability,
          now,
        ),
      }
    }
    case 'reorder-plan-tasks': return reorderPlanTasks(state, action)
    case 'set-plan-availability': {
      const now = new Date()
      return {
        ...state,
        learningPlan: normalizedPlan(state, state.learningPlan.tasks, action.availability, now),
      }
    }
    case 'replace-account': return action.state
    case 'logout': return { ...state, isLoggedIn: false }
    case 'set-font-scale': return { ...state, fontScale: action.scale }
    case 'set-profile': return { ...state, nickname: action.nickname, avatar: action.avatar }
    case 'toggle-like': return { ...state, likes: toggle(state.likes, action.id) }
    case 'toggle-favorite': return { ...state, favorites: toggle(state.favorites, action.id) }
    case 'set-notifications': return { ...state, notifications: action.value }
    case 'set-ai-position': return { ...state, aiPosition: action.position }
    case 'reset-ai-position': return {
      ...state,
      aiPosition: defaultState.aiPosition,
    }
    case 'set-two-factor': return { ...state, twoFactorEnabled: action.enabled }
    case 'update-password': return { ...state, lastPasswordChange: action.lastChange, passwordHint: '刚刚修改' }
    case 'set-guardian': return { ...state, guardian: action.guardian }
    case 'set-family-name': return { ...state, familyName: action.name }
    case 'remove-device': return {
      ...state,
      devices: state.devices.filter((_, i) => i !== action.index),
    }
    case 'set-ai-personality': return { ...state, aiPersonality: action.personality }
    case 'purchase-companion-item': return purchase(state, action)
    case 'equip-companion-item': {
      const loadout = state.companion
      if (!loadout.owned[action.category].includes(action.id)) return state
      return {
        ...state,
        companion: {
          ...loadout,
          equipped: { ...loadout.equipped, [action.category]: action.id },
        },
      }
    }
    case 'unequip-companion-item': {
      const loadout = state.companion
      return {
        ...state,
        companion: {
          ...loadout,
          equipped: { ...loadout.equipped, [action.category]: null },
        },
      }
    }
    case 'set-voice-enabled': return { ...state, voiceEnabled: action.enabled }
    case 'set-auto-listen': return { ...state, autoListenEnabled: action.enabled }
    case 'set-voice-mode': return { ...state, voiceMode: action.mode }
    case 'set-voice-reply-mode': return { ...state, voiceReplyMode: action.mode }
    case 'set-save-history': return { ...state, saveHistory: action.enabled }
    case 'set-ai-memory': return { ...state, aiMemoryEnabled: action.enabled }
    case 'clear-history': return { ...state, historyCount: 0, conversationSummaries: [] }
    case 'set-confirm-dangerous': return { ...state, confirmDangerous: action.enabled }
    case 'set-guardian-approve': return { ...state, guardianApprove: action.enabled }
    case 'set-safe-mode': return { ...state, safeMode: action.mode }
    case 'set-sound-enabled': return { ...state, soundEnabled: action.enabled }
    case 'set-sound-volume': return { ...state, soundVolume: Math.max(0, Math.min(100, action.volume)) }
    case 'set-haptic-enabled': return { ...state, hapticEnabled: action.enabled }
    case 'set-show-stats': return { ...state, showLearningStats: action.enabled }
    case 'set-friend-find': return { ...state, allowFriendFind: action.enabled }
    case 'set-data-collection': return { ...state, dataCollection: action.enabled }
    case 'set-camera-permission': return { ...state, cameraPermission: action.status }
    case 'set-mic-permission': return { ...state, micPermission: action.status }
    case 'set-album-permission': return { ...state, albumPermission: action.status }
    case 'set-content-level': return { ...state, contentLevel: action.level }
    case 'set-personalized-rec': return { ...state, personalizedRec: action.enabled }
    case 'set-auto-clean': return { ...state, autoCleanDays: action.days }
    case 'clear-cache': return { ...state, storageUsed: Math.max(0, state.storageUsed - 120) }
    default: return state
  }
}

type AppStateContextValue = {
  state: AppState
  setGrade: (grade: PrimaryGrade) => void
  completeKnowledge: (partId: CoursePartId, title: string) => void
  passTest: (partId: CoursePartId, title: string) => void
  submitQuizResult: (partId: CoursePartId, title: string, result: QuizResult) => void
  completeCorrection: (wrongAnswerId: string) => void
  recordCreativeWork: (workId: string, occurredAt?: string) => void
  replaceLearningPlan: (tasks: LearningPlanTask[], source: 'student' | 'ai' | 'fallback') => void
  upsertPlanTask: (task: LearningPlanTask) => void
  removePlanTask: (id: string) => void
  reorderPlanTasks: (date: string, ids: string[]) => void
  setPlanAvailability: (availability: DailyAvailability[]) => void
  login: (accountId: string) => void
  logout: () => void
  previewCompanion: (accountId: string) => CompanionLoadout
  setFontScale: (scale: FontScale) => void
  setProfile: (profile: { nickname: string; avatar: number }) => void
  toggleLike: (id: string) => void
  toggleFavorite: (id: string) => void
  setNotifications: (value: AppState['notifications']) => void
  setAiPosition: (position: AiPosition) => void
  resetAiPosition: () => void
  setTwoFactor: (enabled: boolean) => void
  updatePassword: (lastChange: string) => void
  setGuardian: (guardian: GuardianInfo) => void
  setFamilyName: (name: string) => void
  removeDevice: (index: number) => void
  setAiPersonality: (personality: AiPersonality) => void
  purchaseCompanionItem: (category: CompanionCategory, id: string, price: number, name?: string) => void
  equipCompanionItem: (category: CompanionCategory, id: string) => void
  unequipCompanionItem: (category: Exclude<CompanionCategory, 'appearance'>) => void
  setVoiceEnabled: (enabled: boolean) => void
  setAutoListen: (enabled: boolean) => void
  setVoiceMode: (mode: VoiceMode) => void
  setVoiceReplyMode: (mode: VoiceReplyMode) => void
  setSaveHistory: (enabled: boolean) => void
  setAiMemory: (enabled: boolean) => void
  clearHistory: () => void
  setConfirmDangerous: (enabled: boolean) => void
  setGuardianApprove: (enabled: boolean) => void
  setSafeMode: (mode: SafeMode) => void
  setSoundEnabled: (enabled: boolean) => void
  setSoundVolume: (volume: number) => void
  setHapticEnabled: (enabled: boolean) => void
  setShowStats: (enabled: boolean) => void
  setFriendFind: (enabled: boolean) => void
  setDataCollection: (enabled: boolean) => void
  setCameraPermission: (status: PermissionStatus) => void
  setMicPermission: (status: PermissionStatus) => void
  setAlbumPermission: (status: PermissionStatus) => void
  setContentLevel: (level: ContentLevel) => void
  setPersonalizedRec: (enabled: boolean) => void
  setAutoClean: (days: number) => void
  clearCache: () => void
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: PropsWithChildren) {
  const sessionCredential = useOptionalSessionCredential()
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => loadAccountState(defaultState.accountId),
  )

  useEffect(() => {
    document.documentElement.dataset.fontScale = state.fontScale
    saveAccountState(state.accountId, state)
  }, [state])

  const value = useMemo<AppStateContextValue>(() => ({
    state,
    setGrade: (grade) => dispatch({ type: 'set-grade', grade }),
    completeKnowledge: (partId, title) => dispatch({ type: 'complete-knowledge', partId, title, occurredAt: new Date().toISOString() }),
    passTest: (partId, title) => dispatch({ type: 'pass-test', partId, title, occurredAt: new Date().toISOString() }),
    submitQuizResult: (partId, title, result) => dispatch({
      type: 'submit-quiz-result',
      partId,
      title,
      result,
      occurredAt: new Date().toISOString(),
    }),
    completeCorrection: (wrongAnswerId) => dispatch({
      type: 'complete-correction',
      wrongAnswerId,
      occurredAt: new Date().toISOString(),
    }),
    recordCreativeWork: (workId, occurredAt = new Date().toISOString()) => dispatch({
      type: 'record-creative-work',
      workId,
      occurredAt,
    }),
    replaceLearningPlan: (tasks, source) => dispatch({ type: 'replace-learning-plan', tasks, source }),
    upsertPlanTask: (task) => dispatch({ type: 'upsert-plan-task', task }),
    removePlanTask: (id) => dispatch({ type: 'remove-plan-task', id }),
    reorderPlanTasks: (date, ids) => dispatch({ type: 'reorder-plan-tasks', date, ids }),
    setPlanAvailability: (availability) => dispatch({ type: 'set-plan-availability', availability }),
    login: (accountId) => {
      const next = { ...loadAccountState(accountId), isLoggedIn: true }
      saveAccountState(accountId, next)
      dispatch({ type: 'replace-account', state: next })
    },
    logout: () => {
      sessionCredential?.clear()
      dispatch({ type: 'logout' })
    },
    previewCompanion: (accountId) => peekAccountCompanion(accountId),
    setFontScale: (scale) => dispatch({ type: 'set-font-scale', scale }),
    setProfile: (profile) => dispatch({ type: 'set-profile', nickname: profile.nickname, avatar: profile.avatar }),
    toggleLike: (id) => dispatch({ type: 'toggle-like', id }),
    toggleFavorite: (id) => dispatch({ type: 'toggle-favorite', id }),
    setNotifications: (value) => dispatch({ type: 'set-notifications', value }),
    setAiPosition: (position) => dispatch({ type: 'set-ai-position', position }),
    resetAiPosition: () => dispatch({ type: 'reset-ai-position' }),
    setTwoFactor: (enabled) => dispatch({ type: 'set-two-factor', enabled }),
    updatePassword: (lastChange) => dispatch({ type: 'update-password', lastChange }),
    setGuardian: (guardian) => dispatch({ type: 'set-guardian', guardian }),
    setFamilyName: (name) => dispatch({ type: 'set-family-name', name }),
    removeDevice: (index) => dispatch({ type: 'remove-device', index }),
    setAiPersonality: (personality) => dispatch({ type: 'set-ai-personality', personality }),
    purchaseCompanionItem: (category, id, price, name = id) => dispatch({ type: 'purchase-companion-item', category, id, price, name, occurredAt: new Date().toISOString() }),
    equipCompanionItem: (category, id) => dispatch({ type: 'equip-companion-item', category, id }),
    unequipCompanionItem: (category) => dispatch({ type: 'unequip-companion-item', category }),
    setVoiceEnabled: (enabled) => dispatch({ type: 'set-voice-enabled', enabled }),
    setAutoListen: (enabled) => dispatch({ type: 'set-auto-listen', enabled }),
    setVoiceMode: (mode) => dispatch({ type: 'set-voice-mode', mode }),
    setVoiceReplyMode: (mode) => dispatch({ type: 'set-voice-reply-mode', mode }),
    setSaveHistory: (enabled) => dispatch({ type: 'set-save-history', enabled }),
    setAiMemory: (enabled) => dispatch({ type: 'set-ai-memory', enabled }),
    clearHistory: () => dispatch({ type: 'clear-history' }),
    setConfirmDangerous: (enabled) => dispatch({ type: 'set-confirm-dangerous', enabled }),
    setGuardianApprove: (enabled) => dispatch({ type: 'set-guardian-approve', enabled }),
    setSafeMode: (mode) => dispatch({ type: 'set-safe-mode', mode }),
    setSoundEnabled: (enabled) => dispatch({ type: 'set-sound-enabled', enabled }),
    setSoundVolume: (volume) => dispatch({ type: 'set-sound-volume', volume }),
    setHapticEnabled: (enabled) => dispatch({ type: 'set-haptic-enabled', enabled }),
    setShowStats: (enabled) => dispatch({ type: 'set-show-stats', enabled }),
    setFriendFind: (enabled) => dispatch({ type: 'set-friend-find', enabled }),
    setDataCollection: (enabled) => dispatch({ type: 'set-data-collection', enabled }),
    setCameraPermission: (status) => dispatch({ type: 'set-camera-permission', status }),
    setMicPermission: (status) => dispatch({ type: 'set-mic-permission', status }),
    setAlbumPermission: (status) => dispatch({ type: 'set-album-permission', status }),
    setContentLevel: (level) => dispatch({ type: 'set-content-level', level }),
    setPersonalizedRec: (enabled) => dispatch({ type: 'set-personalized-rec', enabled }),
    setAutoClean: (days) => dispatch({ type: 'set-auto-clean', days }),
    clearCache: () => dispatch({ type: 'clear-cache' }),
  }), [sessionCredential, state])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}

export function useOptionalAppState() {
  return useContext(AppStateContext)
}
