// ============================================================
// NumberDisplayNode —— 数值仪表（亮度/数量/计数/音量/置信度读数）
// 左端接收 number（或 confidence），把读数与进度条画在元件上
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Gauge } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function NumberDisplayNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const shown = typeof data.aiState?.shown === 'string' ? data.aiState.shown : '—'
  const ratio = Number(data.aiState?.ratio ?? 0)
  const hasInput = !!data.inputs.value
  const percent = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100
  const maxValue = Number(data.params.maxValue ?? 100)

  return (
    <NodeShell module={module} selected={selected} status={data.aiState?.status as 'idle' | 'running' | 'ready' | 'error' | undefined}>
      <div className="space-y-2">
        {/* 读数 */}
        <div
          className="grid h-[84px] place-items-center rounded-lg"
          style={{
            border: '2px solid var(--ink)',
            background: hasInput ? 'rgba(154,138,106,0.14)' : 'var(--surface-3)',
          }}
        >
          <span className="font-mono text-[34px] font-black leading-none text-ink">{shown}</span>
        </div>

        {/* 满量程进度条 */}
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--ink)' }}>
          <div className="h-full transition-all" style={{ width: `${percent}%`, background: '#9a8a6a' }} />
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] text-text-faint">
          <span className="flex items-center gap-1">
            <Gauge size={11} />
            {hasInput ? '读取中' : '等待数值'}
          </span>
          <span>满量程 {maxValue}</span>
        </div>
      </div>
    </NodeShell>
  )
}

export const NumberDisplayNode = memo(NumberDisplayNodeComp)
