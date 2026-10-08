import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react'
import { defaultState, type AiPersonality, type AiPosition, type AppState, type ContentLevel, type FontScale, type Grade, type GuardianInfo, type LearningStage, type PermissionStatus, type SafeMode, type VoiceMode } from './model'
import { loadState, saveState } from './storage'

type Action =
  | { type: 'set-stage'; stage: LearningStage }
  | { type: 'set-grade'; grade: Grade[LearningStage] }
  | { type: 'login' }
  | { type: 'logout' }
  | { type: 'set-font-scale'; scale: FontScale }
  | { type: 'set-profile'; nickname: string; avatar: number }
  | { type: 'toggle-like'; id: string }
  | { type: 'toggle-favorite'; id: string }
  | { type: 'set-notifications'; value: AppState['notifications'] }
  | { type: 'set-ai-position'; stage: LearningStage; position: AiPosition }
  | { type: 'reset-ai-position'; stage: LearningStage }
  | { type: 'set-two-factor'; enabled: boolean }
  | { type: 'update-password'; lastChange: string }
  | { type: 'set-guardian'; guardian: GuardianInfo }
  | { type: 'set-family-name'; name: string }
  | { type: 'remove-device'; index: number }
  // AI 伙伴
  | { type: 'set-ai-name'; name: string }
  | { type: 'set-ai-personality'; personality: AiPersonality }
  | { type: 'set-ai-skin'; skin: number }
  | { type: 'set-voice-enabled'; enabled: boolean }
  | { type: 'set-auto-listen'; enabled: boolean }
  | { type: 'set-voice-mode'; mode: VoiceMode }
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

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-stage': return { ...state, stage: action.stage }
    case 'set-grade': return { ...state, grade: action.grade }
    case 'login': return { ...state, isLoggedIn: true }
    case 'logout': return { ...state, isLoggedIn: false }
    case 'set-font-scale': return { ...state, fontScale: action.scale }
    case 'set-profile': return { ...state, nickname: action.nickname, avatar: action.avatar }
    case 'toggle-like': return { ...state, likes: toggle(state.likes, action.id) }
    case 'toggle-favorite': return { ...state, favorites: toggle(state.favorites, action.id) }
    case 'set-notifications': return { ...state, notifications: action.value }
    case 'set-ai-position': return {
      ...state,
      aiPositions: { ...state.aiPositions, [action.stage]: action.position },
    }
    case 'reset-ai-position': return {
      ...state,
      aiPositions: {
        ...state.aiPositions,
        [action.stage]: defaultState.aiPositions[action.stage],
      },
    }
    case 'set-two-factor': return { ...state, twoFactorEnabled: action.enabled }
    case 'update-password': return { ...state, lastPasswordChange: action.lastChange, passwordHint: '刚刚修改' }
    case 'set-guardian': return { ...state, guardian: action.guardian }
    case 'set-family-name': return { ...state, familyName: action.name }
    case 'remove-device': return {
      ...state,
      devices: state.devices.filter((_, i) => i !== action.index),
    }
    case 'set-ai-name': return { ...state, aiName: action.name }
    case 'set-ai-personality': return { ...state, aiPersonality: action.personality }
    case 'set-ai-skin': return { ...state, aiSkin: action.skin }
    case 'set-voice-enabled': return { ...state, voiceEnabled: action.enabled }
    case 'set-auto-listen': return { ...state, autoListenEnabled: action.enabled }
    case 'set-voice-mode': return { ...state, voiceMode: action.mode }
    case 'set-save-history': return { ...state, saveHistory: action.enabled }
    case 'set-ai-memory': return { ...state, aiMemoryEnabled: action.enabled }
    case 'clear-history': return { ...state, historyCount: 0 }
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
  setStage: (stage: LearningStage) => void
  setGrade: (grade: Grade[LearningStage]) => void
  login: () => void
  logout: () => void
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
  setAiName: (name: string) => void
  setAiPersonality: (personality: AiPersonality) => void
  setAiSkin: (skin: number) => void
  setVoiceEnabled: (enabled: boolean) => void
  setAutoListen: (enabled: boolean) => void
  setVoiceMode: (mode: VoiceMode) => void
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
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    document.documentElement.dataset.stage = state.stage
    document.documentElement.dataset.fontScale = state.fontScale
    saveState(state)
  }, [state])

  const value = useMemo<AppStateContextValue>(() => ({
    state,
    setStage: (stage) => dispatch({ type: 'set-stage', stage }),
    setGrade: (grade) => dispatch({ type: 'set-grade', grade }),
    login: () => dispatch({ type: 'login' }),
    logout: () => dispatch({ type: 'logout' }),
    setFontScale: (scale) => dispatch({ type: 'set-font-scale', scale }),
    setProfile: (profile) => dispatch({ type: 'set-profile', nickname: profile.nickname, avatar: profile.avatar }),
    toggleLike: (id) => dispatch({ type: 'toggle-like', id }),
    toggleFavorite: (id) => dispatch({ type: 'toggle-favorite', id }),
    setNotifications: (value) => dispatch({ type: 'set-notifications', value }),
    setAiPosition: (position) => dispatch({ type: 'set-ai-position', stage: state.stage, position }),
    resetAiPosition: () => dispatch({ type: 'reset-ai-position', stage: state.stage }),
    setTwoFactor: (enabled) => dispatch({ type: 'set-two-factor', enabled }),
    updatePassword: (lastChange) => dispatch({ type: 'update-password', lastChange }),
    setGuardian: (guardian) => dispatch({ type: 'set-guardian', guardian }),
    setFamilyName: (name) => dispatch({ type: 'set-family-name', name }),
    removeDevice: (index) => dispatch({ type: 'remove-device', index }),
    setAiName: (name) => dispatch({ type: 'set-ai-name', name }),
    setAiPersonality: (personality) => dispatch({ type: 'set-ai-personality', personality }),
    setAiSkin: (skin) => dispatch({ type: 'set-ai-skin', skin }),
    setVoiceEnabled: (enabled) => dispatch({ type: 'set-voice-enabled', enabled }),
    setAutoListen: (enabled) => dispatch({ type: 'set-auto-listen', enabled }),
    setVoiceMode: (mode) => dispatch({ type: 'set-voice-mode', mode }),
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
  }), [state])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}
