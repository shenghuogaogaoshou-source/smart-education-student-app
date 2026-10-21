// ============================================================
// TimerNode —— 定时触发器
// 无输入，按设定间隔自动 emit 信号脉冲（active=true）
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Timer as TimerIcon } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

function TimerNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)

  const timerRef = useRef<number | null>(null)
  const [pulse, setPulse] = useState(false)
  const [count, setCount] = useState(0)

  const interval = Number(data.params.interval ?? 2)

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (!running) return
    const ms = Math.max(200, interval * 1000)
    // 占空比：脉冲持续脉冲宽度 = min(间隔×30%, 300ms)，保证间隔内有足够回落时间
    const pulseWidth = Math.min(300, Math.max(80, ms * 0.3))
    const tick = () => {
      emitPacket(id, 'signal', { type: 'signal', active: true, ts: Date.now() })
      setPulse(true)
      setCount((c) => c + 1)
      // 闪烁回落：pulseWidth 后 active=false，保证信号是闪烁脉冲而非持久为真
      setTimeout(() => {
        emitPacket(id, 'signal', { type: 'signal', active: false, ts: Date.now() })
        setPulse(false)
      }, pulseWidth)
    }
    timerRef.current = window.setInterval(tick, ms)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [running, interval, id, emitPacket])

  const status = running ? 'running' : 'idle'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 定时器可视化 */}
        <div
          className="relative grid h-[88px] place-items-center overflow-hidden rounded-lg"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-3)' }}
        >
          <TimerIcon
            size={pulse ? 30 : 26}
            className="text-green-sig transition-all"
            style={{ filter: pulse ? 'drop-shadow(0 0 8px var(--green))' : 'none' }}
          />
          {/* 同心圆涟漪 */}
          {pulse && (
            <span
              className="pointer-events-none absolute h-10 w-10 rounded-full"
              style={{ border: '2px solid var(--green)', animation: 'ping 0.6s ease-out' }}
            />
          )}
        </div>

        {/* 触发信息 */}
        <div
          className="flex items-center justify-between rounded-md px-2 py-1.5 font-mono text-[11px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <span className="text-text-faint">间隔</span>
          <span className="font-bold text-green-sig">{interval}s</span>
        </div>
        <div
          className="flex items-center justify-between rounded-md px-2 py-1.5 font-mono text-[11px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <span className="text-text-faint">已触发</span>
          <span className="font-bold text-text-dim">{count} 次</span>
        </div>

        {/* 状态 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-1.5 font-mono text-[12px] font-bold transition-all"
          style={{
            background: pulse ? 'rgba(138,171,110,0.18)' : 'rgba(154,138,106,0.10)',
            border: `2px solid ${pulse ? 'var(--green)' : 'var(--border-bright)'}`,
            color: pulse ? 'var(--green)' : 'var(--text-faint)',
          }}
        >
          {running ? (pulse ? '◉ 脉冲触发' : '◯ 等待中…') : '已停止'}
        </div>
      </div>
    </NodeShell>
  )
}

export const TimerNode = memo(TimerNodeComp)
