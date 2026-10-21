// ============================================================
// LEDIndicatorNode —— LED 指示灯（信号为真 → 亮）
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Lightbulb } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

function LEDIndicatorNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const active = isSignalActive(data.inputs.signal)
  const color = String(data.params.color ?? '#10B981')
  const blink = data.params.blink === 'on'
  const freq = Math.max(1, Math.min(10, Number(data.params.blinkFreq ?? 2)))
  const periodMs = 1000 / freq

  const [show, setShow] = useState(true)
  const blinkTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (blinkTimerRef.current) { clearInterval(blinkTimerRef.current); blinkTimerRef.current = null }
    if (blink && active) {
      let on = true
      setShow(true)
      blinkTimerRef.current = window.setInterval(() => {
        on = !on
        setShow(on)
      }, periodMs / 2)
    } else {
      setShow(true)
    }
    return () => { if (blinkTimerRef.current) clearInterval(blinkTimerRef.current) }
  }, [blink, active, periodMs])

  const on = active && show
  const off = !active

  return (
    <NodeShell module={module} selected={selected} status={active ? 'ready' : 'idle'}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">{blink ? `闪烁 ${freq}Hz` : '常亮模式'}</span>
          <span className="chip text-text-faint">{active ? '信号 T' : '信号 F'}</span>
        </div>

        <div
          className="grid h-[110px] place-items-center rounded-lg"
          style={{
            border: '2px solid var(--ink)',
            background: on ? `${color}22` : 'var(--surface-3)',
          }}
        >
          {/* 灯壳 */}
          <div className="relative">
            {/* 光晕 */}
            {on && (
              <span
                className="pointer-events-none absolute inset-0 m-auto h-20 w-20 rounded-full"
                style={{ background: color, filter: `blur(18px) opacity(0.55)` }}
              />
            )}
            {/* 灯泡主体 */}
            <div
              className="relative grid h-20 w-20 place-items-center rounded-full"
              style={{
                border: '2.5px solid var(--ink)',
                background: on ? color : '#e5e0d5',
                boxShadow: on ? `0 0 0 4px ${color}33, inset 0 -6px 14px rgba(0,0,0,0.15)` : 'inset 0 -6px 14px rgba(0,0,0,0.12)',
                transition: 'all 0.15s',
              }}
            >
              <Lightbulb
                size={32}
                style={{
                  color: on ? '#ffffffcc' : '#a8a097',
                  filter: on ? 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' : 'none',
                }}
              />
            </div>
            {/* 底座 */}
            <div
              className="mx-auto -mt-1 h-3 w-14 rounded-b-md"
              style={{
                background: off ? '#8a8076' : '#4a3a2a',
                border: '2px solid var(--ink)',
                borderTop: 'none',
              }}
            />
            <div className="mx-auto h-2 w-10 rounded-b" style={{ background: 'var(--ink)', opacity: 0.7 }} />
          </div>
        </div>

        {/* 状态文字 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-1 font-mono text-[12px] font-bold"
          style={{
            background: on ? `${color}22` : 'rgba(154,138,106,0.1)',
            border: `2px solid ${on ? color : 'var(--border-bright)'}`,
            color: on ? color : 'var(--text-faint)',
          }}
        >
          {on ? '✦ 亮' : off ? '○ 灭' : '○ 间歇'}
        </div>
      </div>
    </NodeShell>
  )
}

export const LEDIndicatorNode = memo(LEDIndicatorNodeComp)
