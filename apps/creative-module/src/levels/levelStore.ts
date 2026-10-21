// ============================================================
// 关卡进度状态管理
// 记录解锁状态、最高通关记录
// ============================================================
import { create } from 'zustand'

interface LevelProgressState {
  /** 已通关的最高关卡 id（0=未通关，初始解锁 L1） */
  maxUnlocked: number
  /** 各关卡最佳成绩（正确率） */
  bestScores: Record<number, number>
  /** 解锁下一关 */
  unlockNext: (levelId: number) => void
  /** 记录成绩 */
  recordScore: (levelId: number, accuracy: number) => void
  /** 重置进度 */
  resetProgress: () => void
}

const STORAGE_KEY = 'ai-circuit-lab-level-progress'

function loadProgress(): { maxUnlocked: number; bestScores: Record<number, number> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { maxUnlocked: parsed.maxUnlocked ?? 1, bestScores: parsed.bestScores ?? {} }
    }
  } catch {
    // ignore
  }
  return { maxUnlocked: 1, bestScores: {} }
}

function saveProgress(state: { maxUnlocked: number; bestScores: Record<number, number> }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export const useLevelProgress = create<LevelProgressState>((set) => ({
  ...loadProgress(),

  unlockNext: (levelId) =>
    set((s) => {
      const next = Math.max(s.maxUnlocked, levelId + 1)
      const newState = { ...s, maxUnlocked: next }
      saveProgress(newState)
      return newState
    }),

  recordScore: (levelId, accuracy) =>
    set((s) => {
      const prev = s.bestScores[levelId] ?? 0
      const bestScores = { ...s.bestScores, [levelId]: Math.max(prev, accuracy) }
      const newState = { ...s, bestScores }
      saveProgress(newState)
      return newState
    }),

  resetProgress: () => {
    const initial = { maxUnlocked: 1, bestScores: {} }
    saveProgress(initial)
    set(initial)
  },
}))
