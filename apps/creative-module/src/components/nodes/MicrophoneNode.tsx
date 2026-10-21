// ============================================================
// MicrophoneNode —— 真实麦克风采集
// getUserMedia(audio) → AnalyserNode 实时音量 → emitPacket 推入电路
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Mic, MicOff, AlertTriangle, Loader2 } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

function MicrophoneNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  // 用户意图（而不是瞬时的 micState）：参数变更重启时 micState 会短暂变 'off'，
  // 用 state 判断会让重启流程误以为“用户关了麦克风”而直接返回，麦克风就此沉默
  const wantOnRef = useRef(false)
  // 已卸载标记：getUserMedia 可能在卸载后才 resolve，那时必须立刻关掉轨道
  const disposedRef = useRef(false)

  const [micState, setMicState] = useState<'off' | 'starting' | 'on' | 'error'>('off')
  const [errMsg, setErrMsg] = useState('')
  const [level, setLevel] = useState(0)

  // 只释放底层资源，不改变用户意图
  const releaseMic = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
  }

  const stopMic = () => {
    wantOnRef.current = false
    releaseMic()
    setMicState('off')
    setLevel(0)
  }

  // 读取参数配置
  const sampleRate = Number(data.params.sampleRate ?? 16000)
  const sensitivity = Math.max(0, Math.min(100, Number(data.params.sensitivity ?? 60))) / 100 // 0~1
  const noiseSuppress = data.params.noiseSuppress !== 'off'
  const sensGain = 0.6 + sensitivity * 2.4   // 0.6~3.0 音量增益

  const startMic = async () => {
    wantOnRef.current = true
    setMicState('starting')
    setErrMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          echoCancellation: true,
          noiseSuppression: noiseSuppress,
          autoGainControl: noiseSuppress,
        } as MediaTrackConstraints,
        video: false,
      })
      // 卸载或用户已关闭：晚到的流直接掐掉，否则音频轨道永远没人 stop()
      if (disposedRef.current || !wantOnRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: sampleRate as AudioContextOptions['sampleRate'] })
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      setMicState('on')
    } catch (e) {
      if (disposedRef.current) return
      wantOnRef.current = false
      setMicState('error')
      setErrMsg((e as Error).message || '无法访问麦克风')
    }
  }

  // 采集循环：仅在运行中 + 麦克风开启时
  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (!running || micState !== 'on' || !analyserRef.current) return
    const analyser = analyserRef.current
    const buf = new Uint8Array(analyser.frequencyBinCount)
    // 电平表每帧刷新（保持灵敏），但推包限制在 ≥100ms 一次（≤10 次/秒）：
    // 逐帧 emitPacket 会让整个 store 重算 DAG 60 次/秒
    let lastEmit = 0
    const tick = () => {
      const an = analyserRef.current
      if (!an) return
      an.getByteTimeDomainData(buf)
      // 计算 RMS 音量（0~1），乘上灵敏度增益
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)
      const lvl = Math.min(1, rms * 2.2 * sensGain)
      setLevel(lvl)
      const now = Date.now()
      if (now - lastEmit >= 100) {
        lastEmit = now
        const stream = streamRef.current
        if (stream) {
          emitPacket(id, 'audio', {
            type: 'audio',
            stream,
            level: lvl,
            ts: now,
          })
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running, micState, id, emitPacket, sensGain])

  // 重启麦克风：参数变更（采样率/噪声抑制）时重新采集
  useEffect(() => {
    // 用 ref 判断“用户想要麦克风开着”，而不是用瞬时的 micState
    if (!wantOnRef.current) return
    releaseMic()
    setMicState('starting')
    const t = window.setTimeout(() => { void startMic() }, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRate, noiseSuppress])

  useEffect(() => () => {
    disposedRef.current = true
    wantOnRef.current = false
    releaseMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const status = micState === 'on' ? (running ? 'running' : 'ready') : micState === 'error' ? 'error' : 'idle'
  const levelPct = Math.round(level * 100)

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 预览区 */}
        <div
          className="relative grid h-[88px] place-items-center overflow-hidden rounded-lg"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-3)' }}
        >
          {micState !== 'on' && (
            <div className="grid place-items-center">
              {micState === 'starting' ? (
                <div className="flex flex-col items-center gap-1.5 text-text-dim">
                  <Loader2 size={20} className="spin-slow" />
                  <span className="chip">连接麦克风…</span>
                </div>
              ) : micState === 'error' ? (
                <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                  <AlertTriangle size={18} className="text-red-sig" />
                  <span className="text-[11px] text-red-sig">{errMsg}</span>
                </div>
              ) : (
                <button
                  onClick={startMic}
                  className="flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 text-text-dim transition hover:text-red-sig"
                >
                  <Mic size={22} />
                  <span className="chip">启用麦克风</span>
                </button>
              )}
            </div>
          )}
          {micState === 'on' && (
            <div className="flex flex-col items-center gap-1.5">
              <Mic size={22} className="text-red-sig" />
              <span className="chip text-text-faint">{running ? '采集中' : '已就绪'}</span>
            </div>
          )}
          {/* 声波涟漪 */}
          {micState === 'on' && running && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full transition-all"
                  style={{
                    height: `${8 + level * 40 * (1 - Math.abs(i - 2) * 0.25)}px`,
                    background: 'var(--red)',
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 音量电平条 */}
        {micState === 'on' && (
          <div className="space-y-1">
            <div
              className="relative h-2.5 overflow-hidden rounded-full"
              style={{ background: 'var(--surface-3)', border: '1.5px solid var(--ink)' }}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all"
                style={{ width: `${levelPct}%`, background: 'var(--red)' }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-text-faint">
              <span>静音</span>
              <span className="text-red-sig">音量 {levelPct}%</span>
              <span>最大</span>
            </div>
          </div>
        )}

        {/* 状态行 */}
        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">
            {micState === 'on' ? (running ? '实时输出' : '已就绪') : '未连接'}
          </span>
          {micState === 'on' && (
            <button
              onClick={stopMic}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-text-faint transition hover:text-red-sig"
            >
              <MicOff size={12} />
              <span className="chip">关闭</span>
            </button>
          )}
        </div>
      </div>
    </NodeShell>
  )
}

export const MicrophoneNode = memo(MicrophoneNodeComp)
