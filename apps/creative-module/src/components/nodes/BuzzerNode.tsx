// ============================================================
// BuzzerNode —— 蜂鸣器（上升沿播放音效/自定义文字朗读）
// 使用 WebAudio 合成 6 种预设音效（避免外部资源依赖）
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Megaphone } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

// -------------------- WebAudio 音效合成（无外部资源） --------------------
let audioCtx: AudioContext | null = null
function ensureCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return audioCtx
}
function playBeep(type: string, gainValue: number, durMs: number) {
  try {
    const ctx = ensureCtx()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.01)
    gain.gain.linearRampToValueAtTime(0, now + durMs / 1000)

    const freqMap: Record<string, number> = {
      beep: 880,
      alarm: 523.25, // C5
      ding: 1046.5,  // C6
      success: 784,  // G5
      fail: 220,     // A3
      tip: 1318.5,   // E6
    }
    const f = freqMap[type] ?? 880

    if (type === 'alarm') {
      // 警报：上下扫频
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(440, now)
      for (let i = 0; i < 3; i++) {
        const t0 = now + (i * durMs / 3) / 1000
        const t1 = now + ((i + 0.5) * durMs / 3) / 1000
        const t2 = now + ((i + 1) * durMs / 3) / 1000
        osc.frequency.linearRampToValueAtTime(880, t1)
        osc.frequency.linearRampToValueAtTime(440, t2)
        void t0
      }
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + durMs / 1000 + 0.02)
    } else if (type === 'ding') {
      // 叮咚：两个音
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 1046.5
      const g1 = ctx.createGain(); g1.gain.value = gainValue * 0.8
      o1.connect(g1); g1.connect(ctx.destination)
      o1.start(now); g1.gain.setValueAtTime(gainValue * 0.8, now); g1.gain.linearRampToValueAtTime(0, now + 0.18); o1.stop(now + 0.2)
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 784
      const g2 = ctx.createGain(); g2.gain.value = 0
      o2.connect(g2); g2.connect(ctx.destination)
      o2.start(now + 0.18); g2.gain.setValueAtTime(gainValue * 0.8, now + 0.18); g2.gain.linearRampToValueAtTime(0, now + 0.45); o2.stop(now + 0.5)
    } else if (type === 'success') {
      // 上行三音
      const notes = [523.25, 659.25, 783.99]
      notes.forEach((nf, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = nf
        const g = ctx.createGain()
        const t0 = now + i * 0.12
        o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0, t0)
        g.gain.linearRampToValueAtTime(gainValue, t0 + 0.02)
        g.gain.linearRampToValueAtTime(0, t0 + 0.16)
        o.start(t0); o.stop(t0 + 0.2)
      })
    } else if (type === 'fail') {
      const notes = [392, 311.13, 261.63]
      notes.forEach((nf, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = nf
        const g = ctx.createGain()
        const t0 = now + i * 0.16
        o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0, t0)
        g.gain.linearRampToValueAtTime(gainValue * 0.6, t0 + 0.03)
        g.gain.linearRampToValueAtTime(0, t0 + 0.2)
        o.start(t0); o.stop(t0 + 0.25)
      })
    } else if (type === 'tip') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1568
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(gainValue, now + 0.01)
      g.gain.linearRampToValueAtTime(0, now + 0.08)
      o.start(now); o.stop(now + 0.1)
    } else {
      // beep 普通
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = f
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + durMs / 1000 + 0.02)
    }
  } catch { /* noop */ }
}

// -------------------- 组件 --------------------
function BuzzerNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const trig = isSignalActive(data.inputs.trigger)
  const txtPkt = data.inputs.text
  const customText = txtPkt?.type === 'text' ? String(txtPkt.value) : ''
  const lastTrigRef = useRef(false)
  const playTimerRef = useRef<number | null>(null)

  const mode = String(data.params.playMode ?? 'sound')
  const preset = String(data.params.presetSound ?? 'beep')
  const volume = Number(data.params.volume ?? 70) / 100
  const dur = Math.max(0.1, Number(data.params.duration ?? 0.5))
  const repeat = Math.max(1, Math.min(10, Number(data.params.repeat ?? 1)))

  const [playing, setPlaying] = useState(false)
  const [idx, setIdx] = useState(0)
  const [msg, setMsg] = useState('待机')

  useEffect(() => {
    if (trig && !lastTrigRef.current) {
      // 上升沿：播放
      if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null }
      setPlaying(true); setIdx(0); setMsg(mode === 'sound' ? `🔔 播放 ${preset}…` : '📢 朗读自定义文字…')

      const gain = Math.max(0, Math.min(1, volume))
      const tickOnce = (i: number) => {
        if (i >= repeat) { setPlaying(false); setMsg('完成'); return }
        setIdx(i + 1)
        if (mode === 'sound') {
          playBeep(preset, gain, dur * 1000)
          playTimerRef.current = window.setTimeout(() => tickOnce(i + 1), dur * 1000 + 100)
        } else {
          // TTS 自定义文字（朗读 1 次就够，repeat 主要留给音效）
          if (customText && 'speechSynthesis' in window) {
            try {
              const u = new SpeechSynthesisUtterance(customText)
              u.volume = gain; u.rate = 1.0; u.lang = 'zh-CN'
              window.speechSynthesis.speak(u)
            } catch { /* noop */ }
          }
          playTimerRef.current = window.setTimeout(() => tickOnce(i + 1), dur * 1000 + 400)
        }
      }
      tickOnce(0)
    }
    lastTrigRef.current = trig
  }, [trig, mode, preset, volume, dur, repeat, customText])

  return (
    <NodeShell module={module} selected={selected} status={playing ? 'running' : 'ready'}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Megaphone size={14} className="text-orange-sig" />
          <span className="chip text-text-faint">{trig ? '触发中' : '等待触发'}</span>
        </div>

        <div
          className="grid h-[96px] place-items-center overflow-hidden rounded-lg"
          style={{
            border: '2px solid var(--ink)',
            background: playing ? 'rgba(249,115,22,0.14)' : 'var(--surface-3)',
          }}
        >
          <div className="text-center">
            <div
              className="text-[40px]"
              style={{ filter: playing ? `drop-shadow(0 0 8px #F97316)` : 'none', transform: playing ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.1s' }}
            >
              {mode === 'sound'
                ? ({ beep: '🔔', alarm: '🚨', ding: '🎵', success: '✅', fail: '❌', tip: '💡' }[preset] ?? '🔔')
                : '📢'}
            </div>
            <div className="mt-1 chip text-text-dim">
              {playing
                ? mode === 'sound' ? `第 ${idx}/${repeat} 次 · ${(dur).toFixed(1)}s` : customText
                : msg}
            </div>
          </div>
        </div>
        {/* 音量条 */}
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div className="h-full rounded-full" style={{ width: `${(volume * 100).toFixed(0)}%`, background: '#F97316' }} />
        </div>
      </div>
    </NodeShell>
  )
}

export const BuzzerNode = memo(BuzzerNodeComp)
