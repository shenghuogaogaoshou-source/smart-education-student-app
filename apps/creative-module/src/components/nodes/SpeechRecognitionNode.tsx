// ============================================================
// SpeechRecognitionNode —— 语音识别（Web Speech API）
// 接收音频 packet，真正调用浏览器 SpeechRecognition API → 输出文字
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Mic2, Languages, RefreshCw } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

type RecState = 'idle' | 'starting' | 'running' | 'error'

function SpeechRecognitionNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)
  const [state, setState] = useState<RecState>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const audioPkt = data.inputs.audio
  const hasAudio = !!audioPkt && audioPkt.type === 'audio'

  const recRef = useRef<any>(null)
  const keepListeningRef = useRef(false)
  const startAttemptRef = useRef<number>(0)
  const supported =
    typeof window !== 'undefined' &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition)

  const lang =
    data.params.language === 'en'
      ? 'en-US'
      : data.params.language === 'auto'
        ? (navigator?.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US')
        : 'zh-CN'
  const continuous = data.params.mode === 'stream'
  const minConf = Number(data.params.confidenceThreshold ?? 0.7)
  // 置信度阈值只用于过滤结果，不参与识别器的创建：
  // 放进 ref 供 onresult 读取，并从依赖里移除，否则拖动滑块会把
  // SpeechRecognition 实例反复 abort / 重建，识别被不停打断
  const minConfRef = useRef(minConf)
  useEffect(() => {
    minConfRef.current = minConf
  }, [minConf])

  useEffect(() => {
    if (!supported) return
    // ✅ 关键修复：只有 running=true 且已接入音频流时才启动识别器
    //    （避免与麦克风模块同时请求 getUserMedia → 冲突 not-allowed）
    if (!running || !hasAudio) {
      // 停止并清理
      const rec = recRef.current
      if (rec) {
        keepListeningRef.current = false
        try { rec.abort() } catch { /* noop */ }
        recRef.current = null
      }
      setState('idle')
      return
    }

    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    // 若已启动且未变化，跳过
    if (recRef.current) return

    const rec = new SR()
    rec.lang = lang
    rec.continuous = true          // 一直用 continuous=true 持续采集，整句模式仅在输出端过滤
    rec.interimResults = true
    rec.maxAlternatives = 1
    recRef.current = rec
    keepListeningRef.current = true
    startAttemptRef.current = 0

    rec.onresult = (ev: any) => {
      let finalText = ''
      let interimText = ''
      let bestConf = 0
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (res.isFinal) {
          finalText += res[0].transcript
          bestConf = Math.max(bestConf, res[0].confidence ?? 0.8)
        } else {
          interimText += res[0].transcript
        }
      }
      setInterim(interimText)
      if (finalText) {
        if (bestConf >= minConfRef.current) {
          const trimmed = finalText.trim()
          setTranscript(trimmed)
          if (continuous || !interimText) {
            emitPacket(id, 'text', { type: 'text', value: trimmed, ts: Date.now() })
          }
        } else {
          setTranscript(`[低于置信度 ${Math.round(bestConf * 100)}%] ${finalText.trim()}`)
        }
      }
    }
    rec.onerror = (e: any) => {
      const err = String(e?.error || '识别错误')
      // Windows 版 Chrome 常见：长时间静音后 no-speech / audio-capture
      if (err === 'no-speech' || err === 'aborted') {
        setErrMsg('')
        setState('idle')
        return
      }
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setErrMsg('未授权麦克风权限。请点击麦克风模块的「启用麦克风」按钮授权，并允许浏览器使用麦克风。')
      } else if (err === 'audio-capture') {
        setErrMsg('未检测到可用的麦克风设备。')
      } else if (err === 'network') {
        setErrMsg('语音识别服务不可用（需要网络）。请检查网络连接。')
      } else {
        setErrMsg(err)
      }
      setState('error')
    }
    rec.onend = () => {
      if (!keepListeningRef.current) {
        setState('idle')
        return
      }
      setState((s) => (s === 'error' ? s : 'idle'))
      // 退避重启：避免连续 start 失败后死循环
      startAttemptRef.current++
      if (startAttemptRef.current > 30) { keepListeningRef.current = false; return }
      const delayMs = Math.min(1500, 60 * startAttemptRef.current)
      window.setTimeout(() => {
        const cur = recRef.current
        if (!cur || !keepListeningRef.current) return
        try {
          cur.start()
          setState('running')
          setErrMsg('')
        } catch {
          /* start 常因 already-started 抛错，忽略 */
        }
      }, delayMs)
    }

    setState('starting')
    try {
      rec.start()
      setState('running')
      setErrMsg('')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }

    return () => {
      keepListeningRef.current = false
      if (recRef.current) {
        try { recRef.current.abort() } catch { /* noop */ }
        recRef.current = null
      }
      setState('idle')
      setInterim('')
    }
  }, [running, hasAudio, supported, lang, continuous, id, emitPacket])

  const status: 'idle' | 'running' | 'ready' | 'error' =
    state === 'error' ? 'error' : state === 'running' || state === 'starting' ? 'running' : hasAudio ? 'ready' : 'idle'

  const showText = transcript || interim

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 标题条 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Languages size={14} className="text-blue-500" />
            <span className="chip text-text-dim">{lang}</span>
            <span className="chip text-text-faint">{continuous ? '流式' : '整句'}</span>
          </div>
          <span className="chip text-text-faint">
            {!supported ? '浏览器不支持'
              : !hasAudio ? '等待音频'
                : state === 'error' ? '出错'
                  : state === 'starting' ? '启动中'
                    : state === 'running' ? '监听中' : '就绪'}
          </span>
        </div>

        {/* 识别区 */}
        <div
          className="relative overflow-hidden rounded-lg p-3"
          style={{
            border: '2px solid var(--ink)',
            background: status === 'running' ? 'rgba(59,130,246,0.08)' : 'var(--surface-3)',
            minHeight: 84,
          }}
        >
          <div className="pointer-events-none absolute right-2 top-2">
            <Mic2
              size={20}
              className={status === 'running' ? 'text-blue-500 blink' : 'text-text-faint'}
            />
          </div>
          {errMsg && (
            <div className="font-mono text-[11px] text-red-sig">错误：{errMsg}</div>
          )}
          {!supported && (
            <div className="font-mono text-[11px] text-text-faint">
              当前浏览器不支持 Web Speech API。推荐使用 Chrome/Edge。
            </div>
          )}
          {supported && !showText && !errMsg && (
            <div className="font-mono text-[11px] text-text-faint">
              {!hasAudio
                ? '连接麦克风模块即可开始识别…'
                : state === 'running'
                  ? '🎙️ 正在聆听…'
                  : '点「运行」后开始说话…'}
            </div>
          )}
          {showText && (
            <>
              <div className="font-mono text-[12px] leading-relaxed text-ink">
                {transcript || <span className="text-text-faint">{interim}<RefreshCw size={10} className="ml-1 inline align-[-1px]" /></span>}
              </div>
              {interim && transcript && (
                <div className="mt-1 font-mono text-[11px] text-text-faint">{interim}</div>
              )}
            </>
          )}
        </div>
      </div>
    </NodeShell>
  )
}

export const SpeechRecognitionNode = memo(SpeechRecognitionNodeComp)
