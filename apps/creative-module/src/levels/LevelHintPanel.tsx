// ============================================================
// LevelHintPanel —— 关卡引导提示面板
// 按步骤展示当前引导文案，检测步骤完成自动推进
// 引导式关卡（guided=true）才显示，自由关卡隐藏
// ============================================================
import { useEffect, useMemo } from 'react'
import {
  Compass,
  CheckCircle2,
  Circle,
  ChevronRight,
  Lightbulb,
} from 'lucide-react'
import { useCircuit } from '../store/circuitStore'
import type { Level } from './types'

interface LevelHintPanelProps {
  level: Level
  hintStep: number
  onHintStepChange: (step: number) => void
}

export function LevelHintPanel({ level, hintStep, onHintStepChange }: LevelHintPanelProps) {
  const nodes = useCircuit((s) => s.nodes)
  const edges = useCircuit((s) => s.edges)
  const running = useCircuit((s) => s.running)

  const hints = level.hints
  const currentHint = hints[hintStep]
  const totalSteps = hints.length
  const allDone = hintStep >= totalSteps

  // 检测当前步骤是否完成
  const stepComplete = useMemo(() => {
    if (allDone) return true
    if (!currentHint) return false
    const h = currentHint
    switch (h.expect) {
      case 'addModule':
        return nodes.some((n) => n.data.moduleType === h.target)
      case 'connect': {
        // 通用连线检测：按 hint.target(源端口) 在 expectedCircuit 中找期望边，
        // 再检查画布上是否存在 sourceType→targetType 的边
        const expected = level.expectedCircuit.find((e) => e.sourcePort === h.target)
        if (!expected) return false
        return edges.some((e) => {
          const src = nodes.find((n) => n.id === e.source)
          const tgt = nodes.find((n) => n.id === e.target)
          if (!src || !tgt) return false
          return (
            src.data.moduleType === expected.sourceType &&
            tgt.data.moduleType === expected.targetType
          )
        })
      }
      case 'setParam': {
        // 检查指定参数是否达到本关要求的值（只判断"非空"会让填错的内容也算过关）
        const targetNode = nodes.find((n) => n.data.moduleType === (h.target ?? 'if'))
        if (!targetNode) return false
        const paramId = h.expectParam ?? 'targetLabel'
        const val = String(targetNode.data.params[paramId] ?? '').trim()
        if (h.expectValue !== undefined) return val === h.expectValue
        return val !== ''
      }
      case 'run':
        return running && nodes.some((n) => n.data.moduleType === h.target)
      default:
        return false
    }
  }, [allDone, currentHint, nodes, edges, running, level])

  // 步骤完成后自动推进
  useEffect(() => {
    if (stepComplete && !allDone) {
      const t = setTimeout(() => onHintStepChange(hintStep + 1), 500)
      return () => clearTimeout(t)
    }
  }, [stepComplete, allDone, hintStep, onHintStepChange])

  if (!level.guided || totalSteps === 0) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <Lightbulb size={26} className="text-amber-dim" />
          <p className="mt-2 text-[13px] leading-relaxed text-text-dim">
            自由模式：用学过的所有模块，自主设计解决方案。
          </p>
          <p className="mt-1 text-[11px] text-text-faint">没有引导，全凭你的创意。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader current={Math.min(hintStep + 1, totalSteps)} total={totalSteps} />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 步骤进度点 */}
        <div className="mb-3 flex items-center justify-center gap-1.5">
          {hints.map((h, i) => {
            const done = i < hintStep
            const active = i === hintStep
            return (
              <div key={h.step} className="flex items-center">
                {done ? (
                  <CheckCircle2 size={14} className="text-green-sig" />
                ) : active ? (
                  <div
                    className="grid h-3.5 w-3.5 place-items-center rounded-full"
                    style={{ background: 'var(--amber)', border: '1.5px solid var(--ink)' }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-ink" />
                  </div>
                ) : (
                  <Circle size={14} className="text-text-faint" />
                )}
                {i < hints.length - 1 && (
                  <div
                    className="mx-0.5 h-[2px] w-4"
                    style={{ background: i < hintStep ? 'var(--green)' : 'var(--border)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* 当前提示卡片 */}
        {!allDone && currentHint ? (
          <div
            className="rounded-lg p-3"
            style={{
              border: `2px solid ${stepComplete ? 'var(--green)' : 'var(--ink)'}`,
              background: stepComplete ? 'rgba(138,171,110,0.12)' : 'var(--surface)',
              boxShadow: '3px 3px 0 0 var(--ink)',
            }}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span
                className="grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] font-bold text-ink"
                style={{ background: 'var(--amber)', border: '1.5px solid var(--ink)' }}
              >
                {currentHint.step}
              </span>
              <span className="chip font-bold text-amber-dim">
                {stepComplete ? '已完成' : '进行中'}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-text">{currentHint.text}</p>
            {stepComplete && (
              <div className="mt-2 flex items-center gap-1 chip text-green-sig">
                <CheckCircle2 size={11} />
                干得漂亮！进入下一步…
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-lg p-3 text-center"
            style={{ border: '2px solid var(--green)', background: 'rgba(138,171,110,0.12)', boxShadow: '3px 3px 0 0 var(--ink)' }}
          >
            <CheckCircle2 size={26} className="mx-auto text-green-sig" />
            <div className="mt-1 handwritten text-[18px] font-bold text-green-sig">所有步骤完成！</div>
            <p className="mt-1 text-[12px] leading-relaxed text-text-dim">
              现在运行电路，观察机器人是否正确抓取垃圾、放过鱼。
              <br />
              达到目标正确率即可通关。
            </p>
          </div>
        )}

        {/* 通关目标 */}
        <div
          className="mt-3 rounded-lg p-2.5"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface-2)' }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <ChevronRight size={12} className="text-text-faint" />
            <span className="chip font-bold text-text-dim">通关目标</span>
          </div>
          <p className="text-[12px] leading-relaxed text-text-dim">{level.goal}</p>
        </div>
      </div>
    </div>
  )
}

function PanelHeader({ current, total }: { current?: number; total?: number }) {
  return (
    <div className="flex items-center justify-between border-b-[2px] border-ink px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Compass size={14} className="text-green-sig" />
        <span className="handwritten text-[17px] font-bold text-ink">引导</span>
      </div>
      {current !== undefined && total !== undefined && (
        <span className="chip text-text-faint">
          第 {current} / {total} 步
        </span>
      )}
    </div>
  )
}
