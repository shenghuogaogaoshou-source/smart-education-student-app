// ============================================================
// TTSPlayerNode —— 音频播放器（Text → SpeechSynthesis）
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Volume2, VolumeX } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

let queue: string[] = []
let busy = false

function playNext(params: Record<string, string | number>, onPlaying: () => void, onEnd: () => void) {
  if (busy || queue.length === 0) return
  const text = queue.shift()!
  if (!text) return playNext(params, onPlaying, onEnd)
  if (!('speechSynthesis' in window)) { onEnd(); return }

  try {
    const voices = window.speechSynthesis.getVoices()
    const gender = String(params.voice ?? 'female')
    let chosen = voices.find((v) => v.lang.startsWith('zh') && (
      gender === 'male' ? /男|male/i.test(v.name) :
      gender === 'child' ? /女|female|xi.*ya|yun.*xia/i.test(v.name) : true
    )) || voices.find((v) => v.lang.startsWith('zh')) || voices[0]

    const u = new SpeechSynthesisUtterance(text)
    if (chosen) u.voice = chosen
    u.lang = chosen?.lang || 'zh-CN'
    u.rate = Math.max(0.5, Math.min(2, Number(params.rate ?? 1)))
    u.pitch = Math.max(0.5, Math.min(2, Number(params.pitch ?? 1)))
    u.volume = Math.max(0, Math.min(1, Number(params.volume ?? 80) / 100))
    u.onstart = () => { busy = true; onPlaying() }
    u.onend = () => { busy = false; playNext(params, onPlaying, onEnd) }
    u.onerror = () => { busy = false; playNext(params, onPlaying, onEnd) }
    window.speechSynthesis.speak(u)
  } catch {
    busy = false
    playNext(params, onPlaying, onEnd)
  }
}

function TTSPlayerNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const pkt = data.inputs.text
  const text = pkt?.type === 'text' ? String(pkt.value) : ''
  const [speaking, setSpeaking] = useState(false)
  const [current, setCurrent] = useState('')
  const lastTextRef = useRef('')
  const lastTsRef = useRef<number>(0)

  const pktTs = pkt?.ts ?? 0
  useEffect(() => {
    if (!text || !pkt) return
    if (pktTs === lastTsRef.current && text === lastTextRef.current) return
    lastTsRef.current = pktTs
    lastTextRef.current = text

    const qMode = String(data.params.queueMode ?? 'queue')
    if (qMode === 'immediate') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      queue = [text]
    } else {
      queue.push(text)
    }
    setCurrent(text)
    playNext(
      data.params,
      () => setSpeaking(true),
      () => {
        setSpeaking(false)
        if (queue.length === 0) setCurrent('')
      },
    )
  }, [text, pkt, pktTs, data.params.queueMode, data.params.voice, data.params.rate, data.params.pitch, data.params.volume])

  const rate = Number(data.params.rate ?? 1)
  const pitch = Number(data.params.pitch ?? 1)
  const vol = Number(data.params.volume ?? 80)

  return (
    <NodeShell module={module} selected={selected} status={speaking ? 'running' : text ? 'ready' : 'idle'}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="chip text-text-dim">
            {speaking ? <Volume2 size={12} className="mr-1 inline align-[-2px]" /> : <VolumeX size={12} className="mr-1 inline align-[-2px]" />}
            {String(data.params.voice)}
          </span>
          <span className="chip text-text-faint">
            {speaking ? '朗读中…' : queue.length > 0 ? `排队 ${queue.length}` : '等待文本'}
          </span>
        </div>

        {/* 当前朗读内容 */}
        <div
          className="rounded-lg p-2"
          style={{
            border: '2px solid var(--ink)',
            background: speaking ? 'rgba(16,185,129,0.1)' : 'var(--surface-3)',
            minHeight: 76,
          }}
        >
          <div className="chip text-text-faint mb-1">当前播报</div>
          <div className="font-mono text-[12px] leading-snug break-words">
            {current || <span className="text-text-faint">请连接文本模块…</span>}
          </div>
        </div>

        {/* 参数条 */}
        <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
          <div className="rounded" style={{ padding: 4, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-text-faint">语速</div><div className="font-bold">{rate.toFixed(1)}x</div>
          </div>
          <div className="rounded" style={{ padding: 4, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-text-faint">音调</div><div className="font-bold">{pitch.toFixed(1)}</div>
          </div>
          <div className="rounded" style={{ padding: 4, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="text-text-faint">音量</div><div className="font-bold">{vol}%</div>
          </div>
        </div>
      </div>
    </NodeShell>
  )
}

export const TTSPlayerNode = memo(TTSPlayerNodeComp)
