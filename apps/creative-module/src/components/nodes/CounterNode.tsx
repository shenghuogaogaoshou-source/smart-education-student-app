// ============================================================
// CounterNode —— 计数器（上升沿+1，达标信号+自动重置）
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Hash, Target, RotateCcw } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

function CounterNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const trig = isSignalActive(data.inputs.trigger)
  const rst = isSignalActive(data.inputs.reset)
  const count = Number(data.aiState?.count ?? 0)
  const target = Number(data.params.target ?? 5)
  const reached = !!data.aiState?.reached
  const percent = Math.min(100, (count / Math.max(1, target)) * 100)

  return (
    <NodeShell module={module} selected={selected} status={data.aiState?.status as any}>
      <div className="space-y-2">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Hash size={14} className="text-orange-sig" />
            <span className="chip">
              目标 <Target size={10} className="mx-0.5 inline align-[-1px]" /> <b>{target}</b>
            </span>
            {data.params.autoReset === 'on' && (
              <span className="chip text-text-dim"><RotateCcw size={10} className="mr-1 inline align-[-1px]" />自动</span>
            )}
          </div>
          <span className="chip text-text-faint">{rst ? '重置中' : trig ? '收到触发' : '待机'}</span>
        </div>

        {/* 计数字体 */}
        <div
          className="relative grid h-[100px] place-items-center overflow-hidden rounded-lg"
          style={{
            border: '2px solid var(--ink)',
            background: reached ? 'rgba(138,171,110,0.14)' : 'var(--surface-3)',
          }}
        >
          <div
            className="font-mono text-[56px] font-black leading-none transition-all"
            style={{
              color: reached ? 'var(--green)' : 'var(--ink)',
              textShadow: reached ? '0 0 12px rgba(138,171,110,0.5)' : 'none',
            }}
          >
            {count}
          </div>
          {/* 进度条底 */}
          <div
            className="absolute bottom-0 left-0 h-1.5 w-full"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${percent}%`,
                background: reached ? 'var(--green)' : '#F97316',
              }}
            />
          </div>
        </div>

        {/* 达标指示 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-1.5 font-mono text-[12px] font-bold"
          style={{
            background: reached ? 'rgba(138,171,110,0.18)' : 'rgba(154,138,106,0.10)',
            border: `2px solid ${reached ? 'var(--green)' : 'var(--border-bright)'}`,
            color: reached ? 'var(--green)' : 'var(--text-faint)',
          }}
        >
          {reached ? '◆ 已达标' : `○ 进度 ${count} / ${target}`}
        </div>
      </div>
    </NodeShell>
  )
}

export const CounterNode = memo(CounterNodeComp)
