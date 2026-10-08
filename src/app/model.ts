export type LearningStage = 'elementary' | 'secondary'
export type FontScale = 'standard' | 'large' | 'xlarge'

export type AiPosition = {
  x: number
  y: number
}

export type Grade = {
  elementary: 'grade1' | 'grade2' | 'grade3' | 'grade4' | 'grade5' | 'grade6'
  secondary: 'grade7' | 'grade8' | 'grade9' | 'grade10' | 'grade11' | 'grade12'
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

export type AppState = {
  stage: LearningStage
  grade: Grade[LearningStage]
  isLoggedIn: boolean
  fontScale: FontScale
  nickname: string
  avatar: number
  likes: string[]
  favorites: string[]
  notifications: 'important' | 'all' | 'off'
  aiPositions: Record<LearningStage, AiPosition>
  // 账号与安全
  accountId: string
  passwordHint: string
  lastPasswordChange: string
  twoFactorEnabled: boolean
  // 监护与家庭
  guardian: GuardianInfo
  familyName: string
  // 登录设备
  devices: DeviceInfo[]
  // AI 伙伴 - 伙伴与互动
  aiName: string
  aiPersonality: AiPersonality
  aiSkin: number
  // AI 伙伴 - 语音与应用控制
  voiceEnabled: boolean
  autoListenEnabled: boolean
  voiceMode: VoiceMode
  // AI 伙伴 - 对话记录与长期记忆
  saveHistory: boolean
  aiMemoryEnabled: boolean
  historyCount: number
  // AI 伙伴 - 操作确认与安全
  confirmDangerous: boolean
  guardianApprove: boolean
  safeMode: SafeMode
  // 声音与触感
  soundEnabled: boolean
  soundVolume: number
  hapticEnabled: boolean
  // 隐私设置
  showLearningStats: boolean
  allowFriendFind: boolean
  dataCollection: boolean
  // 权限
  cameraPermission: PermissionStatus
  micPermission: PermissionStatus
  albumPermission: PermissionStatus
  // 个性化与内容保护
  contentLevel: ContentLevel
  personalizedRec: boolean
  // 存储
  storageUsed: number
  storageTotal: number
  autoCleanDays: number
}

export const defaultState: AppState = {
  stage: 'elementary',
  grade: 'grade5',
  isLoggedIn: false,
  fontScale: 'standard',
  nickname: '晨曦同学',
  avatar: 0,
  likes: [],
  favorites: [],
  notifications: 'important',
  aiPositions: {
    elementary: { x: 0.88, y: 0.78 },
    secondary: { x: 0.88, y: 0.78 },
  },
  accountId: 'chenxi_2026',
  passwordHint: '上次修改：30 天前',
  lastPasswordChange: '2026-08-05',
  twoFactorEnabled: false,
  guardian: {
    name: '陈女士',
    relationship: 'mother',
    phone: '138****6789',
    authorised: true,
  },
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
  saveHistory: true,
  aiMemoryEnabled: true,
  historyCount: 47,
  confirmDangerous: true,
  guardianApprove: false,
  safeMode: 'standard',
  soundEnabled: true,
  soundVolume: 70,
  hapticEnabled: true,
  showLearningStats: true,
  allowFriendFind: false,
  dataCollection: false,
  cameraPermission: 'prompt',
  micPermission: 'prompt',
  albumPermission: 'prompt',
  contentLevel: 'teen',
  personalizedRec: true,
  storageUsed: 286,
  storageTotal: 2048,
  autoCleanDays: 30,
}
