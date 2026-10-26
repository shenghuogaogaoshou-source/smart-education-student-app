import type { CoursePartId, GradeBand, LearningProgress, PrimaryGrade } from './learning'
import type { LearningEvent } from './learningEvents'
import type { PointTransaction } from './points'
import { createDefaultLearningPlan, type LearningPlanState } from './learningPlan'

export const APP_STATE_VERSION = 5 as const

export type FontScale = 'standard' | 'large' | 'xlarge'

export type AiPosition = {
  x: number
  y: number
}

export type GuardianInfo = {
  name: string
  relationship: 'father' | 'mother' | 'grandparent' | 'other'
  phone: string
  authorised: boolean
}

export type DeviceInfo = {
  name: string
  lastActive: string
  current: boolean
}

export type AiPersonality = 'gentle' | 'playful' | 'serious' | 'encouraging'
export type VoiceMode = 'warm' | 'bright' | 'calm'
export type SafeMode = 'strict' | 'standard' | 'relaxed'
export type ContentLevel = 'general' | 'teen' | 'child'
export type PermissionStatus = 'granted' | 'denied' | 'prompt'
export type VoiceReplyMode = 'always' | 'voice-only' | 'silent'

export type ConversationSummary = {
  id: string
  topic: string
  summary: string
  occurredAt: string
}

export type WrongAnswerRecord = {
  id: string
  gradeBand: GradeBand
  partId: CoursePartId
  questionId: string
  prompt: string
  options: string[]
  selectedIndex: number
  answerIndex: number
  explanation: string
  occurredAt: string
  correctedAt: string | null
}

export type GrowthTitle = { text: string; description: string; eventId: string }

export type CompanionCategory = 'appearance' | 'outfit' | 'decoration'

export type CompanionLoadout = {
  owned: Record<CompanionCategory, string[]>
  equipped: Record<CompanionCategory, string | null>
  version: number
}

export type AppState = {
  stateVersion: typeof APP_STATE_VERSION
  grade: PrimaryGrade
  isLoggedIn: boolean
  learningProgress: LearningProgress
  learningPlan: LearningPlanState
  learningEvents: LearningEvent[]
  wrongAnswers: WrongAnswerRecord[]
  growthTitle: GrowthTitle | null
  transactions: PointTransaction[]
  processedRewardIds: string[]
  aiPosition: AiPosition
  companion: CompanionLoadout
  fontScale: FontScale
  nickname: string
  avatar: number
  likes: string[]
  favorites: string[]
  notifications: 'important' | 'all' | 'off'
  accountId: string
  passwordHint: string
  lastPasswordChange: string
  twoFactorEnabled: boolean
  guardian: GuardianInfo
  familyName: string
  devices: DeviceInfo[]
  aiName: string
  aiPersonality: AiPersonality
  aiSkin: number
  voiceEnabled: boolean
  autoListenEnabled: boolean
  voiceMode: VoiceMode
  voiceReplyMode: VoiceReplyMode
  reduceMotion: boolean
  saveHistory: boolean
  aiMemoryEnabled: boolean
  historyCount: number
  conversationSummaries: ConversationSummary[]
  confirmDangerous: boolean
  guardianApprove: boolean
  safeMode: SafeMode
  soundEnabled: boolean
  soundVolume: number
  hapticEnabled: boolean
  showLearningStats: boolean
  allowFriendFind: boolean
  dataCollection: boolean
  cameraPermission: PermissionStatus
  micPermission: PermissionStatus
  albumPermission: PermissionStatus
  contentLevel: ContentLevel
  personalizedRec: boolean
  storageUsed: number
  storageTotal: number
  autoCleanDays: number
}

const DEMO_TRANSACTIONS: PointTransaction[] = [
  { id: 'demo-knowledge', eventId: 'demo:knowledge', kind: 'knowledge', title: '已完成 3 个知识部分', amount: 90, occurredAt: '2026-10-12' },
  { id: 'demo-tests', eventId: 'demo:tests', kind: 'test', title: '已通过 2 个测试关卡', amount: 100, occurredAt: '2026-10-12' },
  { id: 'demo-medals', eventId: 'demo:medals', kind: 'medal', title: '已点亮 2 枚课程徽章', amount: 40, occurredAt: '2026-10-12' },
  { id: 'demo-starter', eventId: 'demo:starter', kind: 'starter', title: '成长体验账号启航积分', amount: 1770, occurredAt: '2026-10-12' },
]

export function createDefaultState(): AppState {
  return {
    stateVersion: APP_STATE_VERSION,
    grade: 'grade5',
    isLoggedIn: false,
    learningProgress: {
      'grade1-2': { knowledgeCompleted: [], testsPassed: [] },
      'grade3-4': { knowledgeCompleted: [], testsPassed: [] },
      'grade5-6': {
        knowledgeCompleted: ['ael-1', 'ael-2', 'ael-3'],
        testsPassed: ['ael-1', 'ael-2'],
      },
    },
    learningPlan: createDefaultLearningPlan(),
    learningEvents: [],
    wrongAnswers: [],
    growthTitle: null,
    transactions: DEMO_TRANSACTIONS.map((transaction) => ({ ...transaction })),
    processedRewardIds: [
      'demo:knowledge', 'demo:tests', 'demo:medals', 'demo:starter',
      'knowledge:ael-1', 'knowledge:ael-2', 'knowledge:ael-3',
      'test:ael-1', 'test:ael-2', 'medal:ael-1', 'medal:ael-2',
    ],
    aiPosition: { x: 0.88, y: 0.84 },
    companion: {
      owned: { appearance: ['momo'], outfit: [], decoration: [] },
      equipped: { appearance: 'momo', outfit: null, decoration: null },
      version: 1,
    },
    fontScale: 'standard',
    nickname: '晨曦同学',
    avatar: 0,
    likes: [],
    favorites: [],
    notifications: 'important',
    accountId: 'chenxi_2026',
    passwordHint: '上次修改：30 天前',
    lastPasswordChange: '2026-08-05',
    twoFactorEnabled: false,
    guardian: { name: '陈女士', relationship: 'mother', phone: '138****6789', authorised: true },
    familyName: '晨曦家庭',
    devices: [
      { name: '当前设备 · 学习平板', lastActive: '刚刚', current: true },
      { name: '家里的学习平板', lastActive: '2 天前', current: false },
      { name: '爸爸的手机', lastActive: '3 周前', current: false },
    ],
    aiName: '小启',
    aiPersonality: 'encouraging',
    aiSkin: 0,
    voiceEnabled: true,
    autoListenEnabled: false,
    voiceMode: 'warm',
    voiceReplyMode: 'voice-only',
    reduceMotion: false,
    saveHistory: true,
    aiMemoryEnabled: true,
    historyCount: 47,
    conversationSummaries: [],
    confirmDangerous: true,
    guardianApprove: false,
    safeMode: 'strict',
    soundEnabled: true,
    soundVolume: 70,
    hapticEnabled: true,
    showLearningStats: true,
    allowFriendFind: false,
    dataCollection: false,
    cameraPermission: 'prompt',
    micPermission: 'prompt',
    albumPermission: 'prompt',
    contentLevel: 'child',
    personalizedRec: true,
    storageUsed: 286,
    storageTotal: 2048,
    autoCleanDays: 30,
  }
}

export const defaultState = createDefaultState()
