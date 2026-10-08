import { defaultState, type AppState } from './model'

const STORAGE_KEY = 'student-app-state'

export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultState
    return { ...defaultState, ...JSON.parse(stored) } as AppState
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState) {
  const safeState: AppState = {
    stage: state.stage,
    grade: state.grade,
    isLoggedIn: state.isLoggedIn,
    fontScale: state.fontScale,
    nickname: state.nickname,
    avatar: state.avatar,
    likes: state.likes,
    favorites: state.favorites,
    notifications: state.notifications,
    aiPositions: state.aiPositions,
    accountId: state.accountId,
    passwordHint: state.passwordHint,
    lastPasswordChange: state.lastPasswordChange,
    twoFactorEnabled: state.twoFactorEnabled,
    guardian: state.guardian,
    familyName: state.familyName,
    devices: state.devices,
    aiName: state.aiName,
    aiPersonality: state.aiPersonality,
    aiSkin: state.aiSkin,
    voiceEnabled: state.voiceEnabled,
    autoListenEnabled: state.autoListenEnabled,
    voiceMode: state.voiceMode,
    saveHistory: state.saveHistory,
    aiMemoryEnabled: state.aiMemoryEnabled,
    historyCount: state.historyCount,
    confirmDangerous: state.confirmDangerous,
    guardianApprove: state.guardianApprove,
    safeMode: state.safeMode,
    soundEnabled: state.soundEnabled,
    soundVolume: state.soundVolume,
    hapticEnabled: state.hapticEnabled,
    showLearningStats: state.showLearningStats,
    allowFriendFind: state.allowFriendFind,
    dataCollection: state.dataCollection,
    cameraPermission: state.cameraPermission,
    micPermission: state.micPermission,
    albumPermission: state.albumPermission,
    contentLevel: state.contentLevel,
    personalizedRec: state.personalizedRec,
    storageUsed: state.storageUsed,
    storageTotal: state.storageTotal,
    autoCleanDays: state.autoCleanDays,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState))
}
