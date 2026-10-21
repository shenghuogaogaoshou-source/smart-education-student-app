// ============================================================
// LevelRunner —— 关卡运行器（关卡主页面）
// 布局：顶部关卡工具栏 / 左市场 / 中场景+画布 / 右引导+检视器
// SceneContext.Provider 包裹整个主体，使画布中的节点能访问场景
// 整合场景面板、电路工作台、引导提示、通关检测
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, ArrowLeft, Trophy, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useCircuit } from '../store/circuitStore'
import { useLevelProgress } from './levelStore'
import { getLevel } from './levelData'
import { LevelScenePanel } from './LevelScenePanel'
import { LevelHintPanel } from './LevelHintPanel'
import { SceneContext, type SceneContextValue } from './SceneContext'
import { Canvas } from '../components/workbench/Canvas'
import type { LevelStats } from './types'
import { AppPanel } from '../components/workbench/AppPanel'

interface LevelRunnerProps {
  levelId: number
  onBack: () => void
}

export function LevelRunner({ levelId, onBack }: LevelRunnerProps) {
  const level = getLevel(levelId)
  const running = useCircuit((s) => s.running)
  const setRunning = useCircuit((s) => s.setRunning)
  const resetCircuit = useCircuit((s) => s.resetCircuit)
  const setPaletteFilter = useCircuit((s) => s.setPaletteFilter)
  // AI 推理引擎与模型状态：模型没就绪就开跑，每张照片都会被判「漏掉」，关卡无法通过
  const engine = useCircuit((s) => s.engine)
  const modelStatus = useCircuit((s) => s.modelStatus)

  const unlockNext = useLevelProgress((s) => s.unlockNext)
  const recordScore = useLevelProgress((s) => s.recordScore)
  const bestScores = useLevelProgress((s) => s.bestScores)

  const [hintStep, setHintStep] = useState(0)
  const [showHints, setShowHints] = useState(false)
  const [stats, setStats] = useState<LevelStats>({
    correct: 0,
    wrong: 0,
    missed: 0,
    total: 0,
    handled: 0,
  })
  const [passed, setPassed] = useState(false)
  const passedRef = useRef(false)

  // 场景状态：由 LevelScenePanel 通过回调设置，供 SceneContext 使用
  const [sceneCanvas, setSceneCanvas] = useState<HTMLCanvasElement | null>(null)
  const armSignalHandlerRef = useRef<((active: boolean) => void) | null>(null)

  const onArmSignal = useCallback((active: boolean) => {
    armSignalHandlerRef.current?.(active)
  }, [])

  // SceneContext 值：包裹整个主体，使画布中的 SceneCameraNode/RoboticArmNode 能访问
  const sceneCtx = useMemo<SceneContextValue>(
    () => ({ sceneCanvas, onArmSignal }),
    [sceneCanvas, onArmSignal],
  )

  const handleSceneCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setSceneCanvas(canvas)
  }, [])

  const handleArmSignalReady = useCallback((handler: (active: boolean) => void) => {
    armSignalHandlerRef.current = handler
  }, [])

  // 用 ref 存储最新的 running 和 level，供回调使用（避免回调依赖变化）
  const runningRef = useRef(running)
  runningRef.current = running
  const levelRef = useRef(level)
  levelRef.current = level

  // 进入关卡：设置模块市场过滤 + 重置电路
  useEffect(() => {
    if (level) {
      setPaletteFilter(level.availableModules)
      resetCircuit()
      setHintStep(0)
      setPassed(false)
      passedRef.current = false
    }
    // 退出关卡时清除过滤
    return () => setPaletteFilter(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId])

  const accuracy = stats.handled > 0 ? stats.correct / stats.handled : 0
  const best = bestScores[levelId]

  // 通关检测：达到最低处理数 + 正确率
  const checkPass = useCallback((s: LevelStats) => {
    if (passedRef.current) return
    const lv = levelRef.current
    if (!lv) return
    if (s.handled >= lv.passMinHandled && s.correct / Math.max(1, s.handled) >= lv.passAccuracy) {
      passedRef.current = true
      setPassed(true)
      setRunning(false)
      recordScore(lv.id, s.correct / s.handled)
      unlockNext(lv.id)
    }
  }, [recordScore, unlockNext, setRunning])

  // 统计回调（用 useCallback + ref 避免 OceanScene 主循环频繁重启）
  const handleStatsChange = useCallback(
    (s: LevelStats) => {
      setStats(s)
      if (runningRef.current) checkPass(s)
    },
    [checkPass],
  )

  const handleRestart = () => {
    setRunning(false)
    resetCircuit()
    setHintStep(0)
    setPassed(false)
    passedRef.current = false
    setStats({ correct: 0, wrong: 0, missed: 0, total: 0, handled: 0 })
  }

  // 关卡不存在：所有 Hook 都必须在任何提前 return 之前调用（规则：Hooks 不能有条件执行）
  if (!level) {
    return (
      <div className="grid h-full place-items-center">
        <span className="text-text-faint">关卡不存在</span>
      </div>
    )
  }

  // 模型就绪前不能开跑（否则每张照片都判「漏掉」，关卡无法通过）
  const engineReady = engine === 'coco-ssd'

  return (
    <div className="level-app paper-bg flex h-full w-full flex-col overflow-hidden">
      {/* 关卡工具栏 */}
      <header className="lab-aurora relative z-20 flex h-14 shrink-0 items-center gap-3 border-b-[2.5px] border-ink bg-surface/80 px-4 backdrop-blur">
        <button className="app-button mobile-hints" onClick={() => setShowHints(true)}>任务提示</button>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] font-bold text-text-dim transition hover:text-ink"
          style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--surface)' }}
        >
          <ArrowLeft size={13} />
          关卡列表
        </button>

        <div className="h-7 w-[2.5px] bg-ink" />

        {/* 关卡标题 */}
        <div className="leading-tight">
          <div className="handwritten text-[20px] font-bold leading-none text-ink">
            L{level.id} · {level.name}
          </div>
          <div className="chip text-text-faint">
            {level.difficulty} · {level.grade}
          </div>
        </div>

        {/* 运行控制：部署在板上的 AI 模型就绪后才允许运行 */}
        <button
          onClick={() => !passed && engineReady && setRunning(!running)}
          disabled={passed || !engineReady}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[13px] font-bold transition-all disabled:opacity-50"
          style={{
            border: '2.5px solid var(--ink)',
            background: running ? 'rgba(198,107,90,0.2)' : 'rgba(138,171,110,0.2)',
            color: running ? 'var(--red)' : 'var(--green)',
            boxShadow: '3px 3px 0 0 var(--ink)',
          }}
        >
          {running ? <Square size={13} /> : <Play size={13} />}
          {running ? '停止' : '运行'}
        </button>

        {/* 模型状态提示：加载中 / 加载失败 */}
        {!engineReady && (
          <span
            className="chip shrink-0 rounded px-2 py-1 text-[11px] font-bold"
            style={{
              border: '2px solid var(--ink)',
              color: modelStatus === 'error' ? 'var(--red)' : 'var(--text-dim)',
              background: modelStatus === 'error' ? 'rgba(198,107,90,0.14)' : 'rgba(212,160,74,0.16)',
            }}
          >
            {modelStatus === 'error' ? '模型加载失败，无法判断垃圾' : '模型加载中…'}
          </span>
        )}

        {/* 重置 */}
        <button
          onClick={handleRestart}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] text-text-dim transition hover:text-amber-dim"
          style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--surface)' }}
        >
          <RefreshCw size={12} />
          重置
        </button>

        {/* 右侧：实时统计 */}
        <div className="ml-auto flex items-center gap-3 font-mono text-[12px]">
          <StatChip label="正确" value={stats.correct} color="#8aab6e" />
          <StatChip label="误抓" value={stats.wrong} color="#c66b5a" />
          <StatChip label="漏掉" value={stats.missed} color="#d4a04a" />
          <div className="h-5 w-[2px] bg-ink/40" />
          <span className="text-text-dim">
            正确率{' '}
            <span
              className="font-bold"
              style={{ color: accuracy >= level.passAccuracy ? 'var(--green)' : 'var(--text-dim)' }}
            >
              {stats.handled > 0 ? Math.round(accuracy * 100) : '--'}%
            </span>
            <span className="text-text-faint"> / {Math.round(level.passAccuracy * 100)}%</span>
          </span>
          <span className="text-text-dim">
            处理 <span className="font-bold text-ink">{stats.handled}</span>
            <span className="text-text-faint"> / {level.passMinHandled}</span>
          </span>
          {best !== undefined && (
            <span className="flex items-center gap-1 text-amber-dim">
              <Trophy size={11} />
              最佳 {Math.round(best * 100)}%
            </span>
          )}
        </div>
      </header>

      {/* 主体布局：SceneContext.Provider 包裹整个主体 */}
      <SceneContext.Provider value={sceneCtx}>
        <div className="flex min-h-0 w-full flex-1 overflow-hidden">
          {/* 左：模块市场 */}


          {/* 中：场景（上）+ 画布（下） */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* 场景区 */}
            <div className="level-scene h-[230px] shrink-0 p-2.5">
              <LevelScenePanel
                running={running}
                sceneType={level.sceneType}
                stats={stats}
                passAccuracy={level.passAccuracy}
                onStatsChange={handleStatsChange}
                onSceneCanvasReady={handleSceneCanvasReady}
                onArmSignalReady={handleArmSignalReady}
              />
            </div>
            {/* 画布区 */}
            <div className="min-h-0 flex-1">
              <Canvas />
            </div>
          </div>

          {/* 右：引导（上）+ 检视器（下） */}
          <div className="level-guide flex w-[280px] shrink-0 flex-col overflow-hidden border-l-[2.5px] border-ink">
            <div className="h-[42%] shrink-0 overflow-hidden border-b-[2px] border-ink bg-surface/60">
              <LevelHintPanel
                level={level}
                hintStep={hintStep}
                onHintStepChange={setHintStep}
              />
            </div>

          </div>
        </div>
      </SceneContext.Provider>
      {showHints && <AppPanel label="任务提示" sheet onClose={() => setShowHints(false)}>
        <div className="flex h-full flex-col"><button className="app-button self-end m-2" onClick={() => setShowHints(false)}>返回画布</button><div className="min-h-0 flex-1 overflow-auto"><LevelHintPanel level={level} hintStep={hintStep} onHintStepChange={setHintStep} /></div></div>
      </AppPanel>}

      {/* 通关弹层 */}
      {passed && (
        <PassOverlay
          levelName={level.name}
          accuracy={accuracy}
          handled={stats.handled}
          isLast={level.id === 5}
          onBack={onBack}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1" style={{ color }}>
      <span className="text-text-faint">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}

function PassOverlay({
  levelName,
  accuracy,
  handled,
  isLast,
  onBack,
  onRestart,
}: {
  levelName: string
  accuracy: number
  handled: number
  isLast: boolean
  onBack: () => void
  onRestart: () => void
}) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm">
      <div
        className="w-[360px] rounded-2xl p-6 text-center"
        style={{ border: '3px solid var(--ink)', background: 'var(--surface)', boxShadow: '6px 6px 0 0 var(--ink)' }}
      >
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full"
          style={{ background: 'var(--green)', border: '3px solid var(--ink)' }}
        >
          <Trophy size={32} className="text-ink" />
        </div>
        <h2 className="mt-3 handwritten text-[28px] font-bold text-green-sig">通关！</h2>
        <p className="mt-1 text-[14px] text-text-dim">{levelName} · 你成功完成了挑战</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg p-2.5"
            style={{ border: '2px solid var(--ink)', background: 'rgba(212,160,74,0.12)' }}
          >
            <div className="chip text-text-faint">正确率</div>
            <div className="handwritten text-[24px] font-bold text-amber-dim">
              {Math.round(accuracy * 100)}%
            </div>
          </div>
          <div
            className="rounded-lg p-2.5"
            style={{ border: '2px solid var(--ink)', background: 'rgba(107,163,195,0.12)' }}
          >
            <div className="chip text-text-faint">处理物体</div>
            <div className="handwritten text-[24px] font-bold text-cyan-sig">{handled}</div>
          </div>
        </div>

        {!isLast && (
          <div
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2 chip text-green-sig"
            style={{ border: '2px solid var(--green)', background: 'rgba(138,171,110,0.12)' }}
          >
            <CheckCircle2 size={13} />
            新模块已解锁，下一关等你挑战！
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onRestart}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 font-mono text-[12px] font-bold text-text-dim transition hover:text-ink"
            style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--surface)' }}
          >
            <RefreshCw size={12} />
            再玩一次
          </button>
          <button
            onClick={onBack}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 font-mono text-[12px] font-bold text-ink transition hover:brightness-95"
            style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--green)' }}
          >
            <ArrowLeft size={12} />
            返回关卡列表
          </button>
        </div>
      </div>
    </div>
  )
}
