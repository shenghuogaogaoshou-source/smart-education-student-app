// ============================================================
// LogicGateNode —— AND / OR / NOT 三种逻辑门
// 共享一个可视化外壳：输入信号小灯 + 运算式 + 输出信号大灯
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

type GateKind = 'and' | 'or' | 'not'

function computeGate(kind: GateKind, a: boolean, b: boolean): boolean {
  if (kind === 'and') return a && b
  if (kind === 'or') return a || b
  return !a // not
}

function GateShell({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const kind = data.moduleType as GateKind
  const status = data.aiState?.status ?? 'idle'

  const aActive = isSignalActive(data.inputs.a)
  const bActive = isSignalActive(data.inputs.b)
  const hasB = kind !== 'not'
  const outActive = computeGate(kind, aActive, bActive)
  const outSignal = isSignalActive(data.outputs.signal)

  const opLabel = { and: 'AND', or: 'OR', not: 'NOT' }[kind]
  const opSymbol = { and: '∧', or: '∨', not: '¬' }[kind]

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 运算式展示 */}
        <div
          className="rounded-lg p-2.5 text-center font-mono"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-2)' }}
        >
          <div className="chip text-text-faint">{opLabel} 运算</div>
          <div className="mt-1 handwritten text-[22px] font-bold text-ink">
            {hasB ? `A ${opSymbol} B` : `${opSymbol}A`}
          </div>
        </div>

        {/* 输入信号灯 */}
        <div className="space-y-1">
          <SignalRow label="A" active={aActive} />
          {hasB && <SignalRow label="B" active={bActive} />}
        </div>

        {/* 输出结果 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-2 font-mono text-[13px] font-bold transition-all"
          style={{
            background: outSignal ? 'rgba(138,171,110,0.18)' : 'rgba(198,107,90,0.12)',
            border: `2px solid ${outSignal ? 'var(--green)' : 'var(--red)'}`,
            color: outSignal ? 'var(--green)' : 'var(--red)',
          }}
        >
          <span
            className="inline-block h-3 w-3 rounded-full border-2"
            style={{
              borderColor: 'var(--ink)',
              background: outSignal ? 'var(--green)' : 'var(--red)',
              boxShadow: outSignal ? '0 0 8px var(--green)' : 'none',
            }}
          />
          {outSignal ? 'TRUE · 成立' : 'FALSE · 不成立'}
        </div>

        {/* 消息 */}
        {data.aiState?.message && (
          <div className="text-center chip text-text-faint">{data.aiState.message}</div>
        )}
      </div>
    </NodeShell>
  )
}

function SignalRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className="flex items-center justify-between rounded-md px-2 py-1 font-mono text-[11px]"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <span className="text-text-faint">信号 {label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border-2"
          style={{
            borderColor: 'var(--ink)',
            background: active ? 'var(--green)' : 'var(--surface-3)',
            boxShadow: active ? '0 0 6px var(--green)' : 'none',
          }}
        />
        <span style={{ color: active ? 'var(--green)' : 'var(--text-faint)' }}>
          {active ? 'TRUE' : 'FALSE'}
        </span>
      </span>
    </div>
  )
}

export const AndNode = memo(GateShell)
export const OrNode = memo(GateShell)
export const NotNode = memo(GateShell)
