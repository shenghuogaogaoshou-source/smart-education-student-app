// ============================================================
// IfNode —— 条件判断（仅按标签匹配）
// 可视化"标签是否匹配"如何把 AI 的文字判断变成真实行动信号
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

function IfNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const status = data.aiState?.status ?? 'idle'

  const labelPkt = data.inputs.label
  const label = labelPkt && labelPkt.type === 'label' ? String(labelPkt.value) : null

  const target = String(data.params.targetLabel ?? '')
  const match = label !== null && target.trim() !== '' && label.toLowerCase().includes(target.toLowerCase())
  const active = isSignalActive(data.outputs.signal)

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 规则展示 */}
        <div
          className="rounded-lg p-2 font-mono text-[11px] leading-relaxed"
          style={{ border: '1.5px solid var(--ink)', background: 'rgba(244,234,213,0.5)' }}
        >
          <div className="text-text-faint">IF</div>
          <div className="flex items-center gap-1.5 pl-2">
            <span className={match ? 'font-bold text-green-sig' : 'text-text-dim'}>
              标签包含 "{target}"
            </span>
            <span className="text-text-faint">→ {match ? '✓' : '✗'}</span>
          </div>
        </div>

        {/* 当前输入 */}
        <div
          className="flex items-center justify-between rounded-md px-2 py-1 font-mono text-[11px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <span className="text-text-faint">当前标签</span>
          <span className="text-text-dim">{label ?? '—'}</span>
        </div>

        {/* 信号输出指示 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-1.5 font-mono text-[12px] font-bold transition-all"
          style={{
            background: active ? 'rgba(138,171,110,0.18)' : 'rgba(198,107,90,0.12)',
            border: `2px solid ${active ? 'var(--green)' : 'var(--red)'}`,
            color: active ? 'var(--green)' : 'var(--red)',
          }}
        >
          {active ? '◉ 信号 TRUE · 触发' : '◯ 信号 FALSE · 不触发'}
        </div>
      </div>
    </NodeShell>
  )
}

export const IfNode = memo(IfNodeComp)
