// ============================================================
// DelayTimerNode —— 延时器（N 秒后再输出信号）
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Clock } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

type Phase = 'idle' | 'counting' | 'fire'

function DelayTimerNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)

  const trig = isSignalActive(data.inputs.trigger)
  const delaySec = Math.max(0.1, Number(data.params.delay ?? 2))
  const delayMs = delaySec * 1000

  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const lastTrigRef = useRef(false)
  const startAtRef = useRef(0)
  const fireTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  // 倒计时/回落链是否仍在跑：定时器被清掉后要靠它重新武装
  const armedRef = useRef(false)

  // 清掉所有挂起的定时器与动画帧（停止 / 卸载 / 依赖变化时都走这里）
  const clearTimers = () => {
    armedRef.current = false
    if (fireTimerRef.current) {
      clearTimeout(fireTimerRef.current)
      fireTimerRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  useEffect(() => {
    if (!running) {
      // 停止：清定时器 + 复位边沿检测与显示状态。
      // 不复位 lastTrigRef 的话，停止→运行时 trig 仍是 true，上升沿永远不会再来，
      // 表现为“再运行也不触发、界面卡在倒计时中”。
      clearTimers()
      lastTrigRef.current = false
      setPhase('idle')
      setElapsed(0)
      return () => clearTimers()
    }

    // 上升沿（或延时参数变化导致链被清掉后仍在激活状态）：启动倒计时
    if (trig && (!lastTrigRef.current || !armedRef.current)) {
      startAtRef.current = performance.now()
      setPhase('counting')
      setElapsed(0)
      if (fireTimerRef.current) clearTimeout(fireTimerRef.current)
      armedRef.current = true
      fireTimerRef.current = window.setTimeout(() => {
        // 到时：先亮，再回落
        emitPacket(id, 'delayed', { type: 'signal', active: true, ts: Date.now() })
        setPhase('fire')
        fireTimerRef.current = window.setTimeout(() => {
          fireTimerRef.current = null
          armedRef.current = false
          emitPacket(id, 'delayed', { type: 'signal', active: false, ts: Date.now() })
          setPhase('idle')
        }, 250)
      }, delayMs)

      // 进度条
      const tick = () => {
        const e = performance.now() - startAtRef.current
        setElapsed(e)
        if (e < delayMs) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    // 下降沿：取消
    if (!trig && lastTrigRef.current) {
      clearTimers()
      setPhase('idle')
      setElapsed(0)
    }

    lastTrigRef.current = trig
    // 卸载 / 依赖变化：挂起的 fireTimer、回落定时器与 raf 一并清掉，
    // 否则节点被删后还会发出一次 delayed 脉冲
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trig, running, delayMs, id, emitPacket])

  const percent = phase === 'counting' ? Math.min(100, (elapsed / delayMs) * 100) : phase === 'fire' ? 100 : 0
  const remain = Math.max(0, (delayMs - elapsed) / 1000).toFixed(1)

  return (
    <NodeShell module={module} selected={selected} status={phase === 'idle' ? 'idle' : 'running'}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-orange-sig" />
            <span className="chip">延时 <b>{delaySec}s</b></span>
          </div>
          <span className="chip text-text-faint">
            {phase === 'idle' ? '未启动' : phase === 'counting' ? '倒计时中…' : '触发！'}
          </span>
        </div>

        <div
          className="grid h-[100px] place-items-center overflow-hidden rounded-lg"
          style={{
            border: '2px solid var(--ink)',
            background: phase === 'fire'
              ? 'rgba(249,115,22,0.18)'
              : phase === 'counting'
                ? 'rgba(249,115,22,0.08)'
                : 'var(--surface-3)',
          }}
        >
          {phase === 'idle' && (
            <span className="font-mono text-[32px] font-black text-text-faint">⏳</span>
          )}
          {phase === 'counting' && (
            <div className="text-center">
              <div className="font-mono text-[30px] font-black text-orange-sig">
                {remain}
                <span className="ml-1 text-[14px] text-text-dim">秒</span>
              </div>
              <div className="mt-2 h-2 w-40 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: '#F97316' }} />
              </div>
            </div>
          )}
          {phase === 'fire' && (
            <div
              className="rounded-full bg-orange-sig text-white font-mono text-[28px] font-black px-5 py-2 blink"
              style={{ boxShadow: '0 0 20px rgba(249,115,22,0.55)' }}
            >
              🎯 输出
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  )
}

export const DelayTimerNode = memo(DelayTimerNodeComp)
