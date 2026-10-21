// ============================================================
// TTSPlayerNode —— 音频播放器（Text → SpeechSynthesis）
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Volume2, VolumeX } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

/** 每个 TTS 节点独占的播报状态（原先放在模块级 → 所有节点共用一份队列，串台） */
interface TtsCtl {
  queue: string[]
  busy: boolean
  /** 当前正在播的语句，用于身份校验：旧语句的 onend 不得推进新队列 */
  utter: SpeechSynthesisUtterance | null
  /** 已卸载：晚到的回调不再改状态 */
  disposed: boolean
  onPlaying: () => void
  onEnd: () => void
}

function playNext(ctl: TtsCtl, params: Record<string, string | number>) {
  if (ctl.disposed || ctl.busy || ctl.queue.length === 0) return
  const text = ctl.queue.shift()!
  if (!text) return playNext(ctl, params)
  if (!('speechSynthesis' in window)) { ctl.onEnd(); return }

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
    u.onstart = () => {
      if (ctl.disposed || ctl.utter !== u) return
      ctl.busy = true
      ctl.onPlaying()
    }
    u.onend = () => {
      if (ctl.utter !== u) return   // 已不是当前语句（被取消/替换）：不推进队列
      ctl.utter = null
      ctl.busy = false
      ctl.onEnd()
      playNext(ctl, params)
    }
    u.onerror = () => {
      if (ctl.utter !== u) return
      ctl.utter = null
      ctl.busy = false
      ctl.onEnd()
      playNext(ctl, params)
    }
    ctl.utter = u
    window.speechSynthesis.speak(u)
  } catch {
    ctl.busy = false
    playNext(ctl, params)
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

  // 队列 / 忙碌标记 / 当前语句全部是本节点私有的（模块级单例会让不同节点互相抢播）
  const ctlRef = useRef<TtsCtl | null>(null)
  if (!ctlRef.current) {
    ctlRef.current = {
      queue: [],
      busy: false,
      utter: null,
      disposed: false,
      onPlaying: () => setSpeaking(true),
      onEnd: () => {
        setSpeaking(false)
        if (ctlRef.current && ctlRef.current.queue.length === 0) setCurrent('')
      },
    }
  }
  const ctl = ctlRef.current

  const pktTs = pkt?.ts ?? 0
  useEffect(() => {
    if (!text || !pkt) return
    if (pktTs === lastTsRef.current && text === lastTextRef.current) return
    lastTsRef.current = pktTs
    lastTextRef.current = text

    const qMode = String(data.params.queueMode ?? 'queue')
    if (qMode === 'immediate') {
      // 立刻打断：只清本节点的队列与语句身份，再取消浏览器中正在播的语音
      ctl.busy = false
      ctl.utter = null
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      ctl.queue = [text]
      setSpeaking(false)
    } else {
      ctl.queue.push(text)
    }
    setCurrent(text)
    playNext(ctl, data.params)
  }, [text, pkt, pktTs, data.params, ctl])

  // 卸载：停掉本节点的播报（浏览器没有“取消单条语句”的 API，
  // 因此先摘掉本节点语句的回调再 cancel，避免它再去推进/污染队列）
  useEffect(() => {
    return () => {
      const c = ctlRef.current
      if (!c) return
      c.disposed = true
      c.queue = []
      c.busy = false
      const u = c.utter
      c.utter = null
      if (u) {
        u.onend = null
        u.onerror = null
        u.onstart = null
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      }
    }
  }, [])

  const rate = Number(data.params.rate ?? 1)
  const pitch = Number(data.params.pitch ?? 1)
  const vol = Number(data.params.volume ?? 80)
  const queued = ctl.queue.length

  return (
    <NodeShell module={module} selected={selected} status={speaking ? 'running' : text ? 'ready' : 'idle'}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="chip text-text-dim">
            {speaking ? <Volume2 size={12} className="mr-1 inline align-[-2px]" /> : <VolumeX size={12} className="mr-1 inline align-[-2px]" />}
            {String(data.params.voice)}
          </span>
          <span className="chip text-text-faint">
            {speaking ? '朗读中…' : queued > 0 ? `排队 ${queued}` : '等待文本'}
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
