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

  const [micState, setMicState] = useState<'off' | 'starting' | 'on' | 'error'>('off')
  const [errMsg, setErrMsg] = useState('')
  const [level, setLevel] = useState(0)

  const stopMic = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    setMicState('off')
    setLevel(0)
  }

  // 读取参数配置
  const sampleRate = Number(data.params.sampleRate ?? 16000)
  const sensitivity = Math.max(0, Math.min(100, Number(data.params.sensitivity ?? 60))) / 100 // 0~1
  const noiseSuppress = data.params.noiseSuppress !== 'off'
  const sensGain = 0.6 + sensitivity * 2.4   // 0.6~3.0 音量增益

  const startMic = async () => {
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
    if (!running || micState !== 'on') return
    const buf = new Uint8Array(analyserRef.current!.frequencyBinCount)
    const tick = () => {
      const analyser = analyserRef.current
      if (!analyser) return
      analyser.getByteTimeDomainData(buf)
      // 计算 RMS 音量（0~1），乘上灵敏度增益
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)
      const lvl = Math.min(1, rms * 2.2 * sensGain)
      setLevel(lvl)
      emitPacket(id, 'audio', {
        type: 'audio',
        stream: streamRef.current!,
        level: lvl,
        ts: Date.now(),
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running, micState, id, emitPacket, sensGain])

  // 重启麦克风：参数变更（采样率/噪声抑制）时重新采集
  useEffect(() => {
    if (micState !== 'on') return
    stopMic()
    const t = window.setTimeout(() => startMic(), 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRate, noiseSuppress])

  useEffect(() => () => stopMic(), [])

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
