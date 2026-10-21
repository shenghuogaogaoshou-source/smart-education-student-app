// ============================================================
// 场景上下文 —— 让关卡专用节点访问场景
// 场景相机：从 sceneCanvas 采集画面
// 机械臂：通过 onArmSignal 通知场景执行抓取/放行
// ============================================================
import { createContext, useContext } from 'react'

export interface SceneContextValue {
  /** 场景 canvas 引用（场景相机从中采集画面） */
  sceneCanvas: HTMLCanvasElement | null
  /** 机械臂信号回调：active=true 抓取，false 放行 */
  onArmSignal: (active: boolean) => void
}

export const SceneContext = createContext<SceneContextValue | null>(null)

export function useScene(): SceneContextValue | null {
  return useContext(SceneContext)
}
