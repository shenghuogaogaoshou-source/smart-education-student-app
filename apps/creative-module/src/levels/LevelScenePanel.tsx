// ============================================================
// LevelScenePanel —— 关卡场景面板
// 渲染场景渲染器（OceanScene 等）+ 统计 HUD
// sceneCanvas 和 armSignalHandler 通过回调暴露给父组件，
// 由父组件创建 SceneContext.Provider 供画布中的节点访问
// ============================================================
import { useCallback, useState } from 'react'
import { OceanScene } from './scenes/OceanScene'
import type { LevelStats } from './types'
import { CheckCircle2, XCircle, CircleSlash, Target } from 'lucide-react'

interface LevelScenePanelProps {
  running: boolean
  /** 当前关卡的场景类型 */
  sceneType: string
  /** 统计变化回调（供父组件做通关检测） */
  onStatsChange: (stats: LevelStats) => void
  /** 场景 canvas 就绪回调（父组件用于创建 SceneContext） */
  onSceneCanvasReady: (canvas: HTMLCanvasElement) => void
  /** 机械臂信号处理器就绪回调（父组件用于创建 SceneContext） */
  onArmSignalReady: (handler: (active: boolean) => void) => void
}

export function LevelScenePanel({
  running,
  sceneType,
  onStatsChange,
  onSceneCanvasReady,
  onArmSignalReady,
}: LevelScenePanelProps) {
  const [stats, setStats] = useState<LevelStats>({
    correct: 0,
    wrong: 0,
    missed: 0,
    total: 0,
    handled: 0,
  })

  const handleStatsChange = useCallback(
    (s: LevelStats) => {
      setStats(s)
      onStatsChange(s)
    },
    [onStatsChange],
  )

  const handleCanvasReady = useCallback(
    (canvas: HTMLCanvasElement) => {
      onSceneCanvasReady(canvas)
    },
    [onSceneCanvasReady],
  )

  const handleArmSignalReady = useCallback(
    (handler: (active: boolean) => void) => {
      onArmSignalReady(handler)
    },
    [onArmSignalReady],
  )

  // 正确率（已处理中正确的比例）
  const handled = stats.handled
  const accuracy = handled > 0 ? stats.correct / handled : 0

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* 场景容器 */}
      <div
        className="relative min-h-0 flex-1"
        style={{ border: '2.5px solid var(--ink)', borderRadius: 12, overflow: 'hidden' }}
      >
        {sceneType === 'ocean' ? (
          <OceanScene
            running={running}
            onCanvasReady={handleCanvasReady}
            onArmSignalReady={handleArmSignalReady}
            onStatsChange={handleStatsChange}
          />
        ) : (
          <div className="grid h-full place-items-center bg-surface-2 text-text-faint">
            <span className="chip">该场景开发中…</span>
          </div>
        )}

        {/* 场景未运行遮罩 */}
        {!running && (
          <div className="absolute inset-0 grid place-items-center bg-bg/60 backdrop-blur-[1px]">
            <div className="text-center">
              <div
                className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full"
                style={{ border: '2.5px solid var(--ink)', background: 'var(--green)' }}
              >
                <Target size={22} className="text-ink" />
              </div>
              <div className="handwritten text-[18px] font-bold text-ink">搭建好电路后点击运行</div>
              <div className="chip text-text-faint">机器人需要 AI 大脑才能开始工作</div>
            </div>
          </div>
        )}

        {/* 统计 HUD */}
        <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-1.5">
          <StatBadge icon={CheckCircle2} color="#8aab6e" label="正确" value={stats.correct} />
          <StatBadge icon={XCircle} color="#c66b5a" label="误抓" value={stats.wrong} />
          <StatBadge icon={CircleSlash} color="#d4a04a" label="漏掉" value={stats.missed} />
        </div>

        {/* 正确率进度条 */}
        <div className="pointer-events-none absolute bottom-2 left-2 right-2">
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-bold"
            style={{
              border: '2px solid var(--ink)',
              background: 'rgba(253,246,227,0.92)',
              boxShadow: '2px 2px 0 0 var(--ink)',
            }}
          >
            <Target size={12} className="text-amber-dim" />
            <span className="text-text-dim">正确率</span>
            <span
              style={{
                color: accuracy >= 0.8 ? 'var(--green)' : accuracy >= 0.5 ? 'var(--amber-dim)' : 'var(--red)',
              }}
            >
              {handled > 0 ? Math.round(accuracy * 100) : '--'}%
            </span>
            <div className="flex-1" />
            <span className="text-text-faint">已处理 {handled}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBadge({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof CheckCircle2
  color: string
  label: string
  value: number
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] font-bold"
      style={{
        border: '2px solid var(--ink)',
        background: 'rgba(253,246,227,0.92)',
        color,
        boxShadow: '1.5px 1.5px 0 0 var(--ink)',
      }}
    >
      <Icon size={11} />
      <span className="text-text-dim">{label}</span>
      <span>{value}</span>
    </div>
  )
}
