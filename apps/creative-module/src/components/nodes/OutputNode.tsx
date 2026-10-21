// ============================================================
// OutputNode —— 行动输出
// 收到 TRUE 信号时执行真实动作（门/灯/警报/机器人），含动画反馈
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function OutputNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const sigPkt = data.inputs.signal
  const active = !!(sigPkt && sigPkt.type === 'signal' && sigPkt.active)
  const action = String(data.params.action ?? 'door')

  return (
    <NodeShell
      module={module}
      selected={selected}
      status={active ? 'running' : sigPkt ? 'ready' : 'idle'}
    >
      <div className="space-y-2">
        {/* 动作舞台 */}
        <div
          className="relative grid h-24 place-items-center overflow-hidden rounded-lg"
          style={{ border: '2px solid var(--ink)', background: 'rgba(244,234,213,0.6)' }}
        >
          <ActionStage action={action} active={active} />
        </div>

        {/* 状态条 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-1.5 font-mono text-[12px] font-bold transition-all"
          style={{
            background: active ? 'rgba(138,171,110,0.18)' : 'rgba(154,138,106,0.12)',
            border: `2px solid ${active ? 'var(--green)' : 'var(--border-bright)'}`,
            color: active ? 'var(--green)' : 'var(--text-faint)',
          }}
        >
          {active ? '💡 灯泡亮起' : '○ 灯泡熄灭'}
        </div>
      </div>
    </NodeShell>
  )
}

function ActionStage({ action, active }: { action: string; active: boolean }) {
  if (action === 'door') {
    return (
      <div className="flex h-full w-full items-center justify-center gap-3 px-4">
        <div
          className="relative h-16 w-10 rounded-sm"
          style={{ border: '2.5px solid var(--ink)', background: 'var(--surface-2)' }}
        >
          <div
            className="absolute left-0 top-0 h-full origin-left rounded-sm transition-transform duration-500"
            style={{
              border: '2.5px solid var(--ink)',
              background: 'var(--surface-3)',
              transform: active ? 'perspective(120px) rotateY(-78deg)' : 'rotateY(0deg)',
              transformStyle: 'preserve-3d',
            }}
          />
          <div className="absolute right-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full" style={{ background: 'var(--amber)', border: '1px solid var(--ink)' }} />
        </div>
        <div className="text-center">
          <div className="chip text-text-faint">AUTO DOOR</div>
          <div className="mt-1 font-mono text-[12px] font-bold" style={{ color: active ? 'var(--green)' : 'var(--text-faint)' }}>
            {active ? 'OPEN' : 'CLOSED'}
          </div>
        </div>
      </div>
    )
  }

  if (action === 'light') {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="grid h-12 w-12 place-items-center rounded-full border-[2.5px] transition-all duration-300"
          style={{
            borderColor: 'var(--ink)',
            background: active ? 'radial-gradient(circle, var(--amber-bright), var(--amber))' : 'var(--surface-3)',
          }}
        >
          <div
            className="h-4 w-4 rounded-full"
            style={{ background: active ? '#fff8e0' : 'var(--border-bright)' }}
          />
        </div>
        <div className="chip font-bold" style={{ color: active ? 'var(--amber-dim)' : 'var(--text-faint)' }}>
          {active ? 'ON' : 'OFF'}
        </div>
      </div>
    )
  }

  if (action === 'alarm') {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={`grid h-12 w-12 place-items-center rounded-full border-[2.5px] ${active ? 'blink' : ''}`}
          style={{
            borderColor: 'var(--ink)',
            background: active ? 'rgba(198,107,90,0.2)' : 'var(--surface-3)',
          }}
        >
          <span className="text-xl">🔔</span>
        </div>
        <div className="chip font-bold" style={{ color: active ? 'var(--red)' : 'var(--text-faint)' }}>
          {active ? 'ALARMING' : 'SILENT'}
        </div>
      </div>
    )
  }

  // wave
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-4xl" style={{ filter: active ? 'none' : 'grayscale(0.8) opacity(0.5)' }}>
        <span className={active ? 'inline-block blink' : 'inline-block'}>🤖</span>
      </div>
      <div className="chip font-bold" style={{ color: active ? 'var(--green)' : 'var(--text-faint)' }}>
        {active ? 'WAVING 👋' : 'IDLE'}
      </div>
    </div>
  )
}

export const OutputNode = memo(OutputNodeComp)
