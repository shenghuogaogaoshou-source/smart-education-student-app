// ============================================================
// TextNode —— 文本输入
// 学生输入文字 → emitPacket 推入电路（作为 AI 的文本输入）
// 三种触发方式：auto 运行时自动发 / button 手动点发送 / signal 外部 send 信号上升沿
// ============================================================
import { memo, useEffect, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Type, Send } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'

type TriggerMode = 'auto' | 'button' | 'signal'

function TextNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)
  const updateParam = useCircuit((s) => s.updateParam)

  const text = String(data.params.text ?? '')
  const mode: TriggerMode = String(data.params.trigger ?? 'auto') as TriggerMode
  const sendActive = isSignalActive(data.inputs.send)

  // 上一帧的模式/运行/文本/信号：只在真正需要时发送，切换触发方式本身绝不触发发送
  const prevRef = useRef({ mode, running, text, send: sendActive })
  const modeRef = useRef<TriggerMode>(mode)
  const [sentAt, setSentAt] = useState(0)

  // 统一的输出逻辑：auto（运行中自动）/ button（点击）/ signal（send 上升沿）
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { mode, running, text, send: sendActive }
    const modeChanged = modeRef.current !== mode
    modeRef.current = mode

    // 切换触发方式：只同步状态，不发包
    if (modeChanged) return
    if (!text) return

    const emit = () => emitPacket(id, 'text', { type: 'text', value: text, ts: Date.now() })

    if (mode === 'auto') {
      // 原来行为：运行中，且运行状态或文本发生变化时输出一次
      if (running && (running !== prev.running || text !== prev.text)) emit()
    } else if (mode === 'signal') {
      // 上升沿（false → true）才输出，持续为真不会重复发
      if (sendActive && !prev.send) {
        emit()
        setSentAt(Date.now())
      }
    }
    // button 模式只由按钮点击发送
  }, [mode, sendActive, running, text, id, emitPacket])

  // 手动发送：点一次发一次
  const sendNow = () => {
    if (!text) return
    emitPacket(id, 'text', { type: 'text', value: text, ts: Date.now() })
    setSentAt(Date.now())
  }

  const status = mode === 'button' ? (text ? 'ready' : 'idle') : running ? 'running' : 'idle'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 文本输入区 */}
        <div
          className="rounded-lg p-2"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-2)' }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <Type size={12} className="text-orange-sig" />
            <span className="chip font-bold text-text-dim">输入文字</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => updateParam(id, 'text', e.target.value)}
            placeholder="在这里输入文字…"
            rows={3}
            className="w-full resize-none rounded-md px-2 py-1.5 font-kalam text-[14px] leading-relaxed text-text focus:outline-none"
            style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
          />
        </div>

        {/* 手动发送按钮（仅 button 模式） */}
        {mode === 'button' && (
          <button
            onClick={sendNow}
            disabled={!text}
            className="nodrag flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 font-mono text-[11px] font-bold transition disabled:opacity-40"
            style={{
              border: '1.5px solid var(--ink)',
              background: 'var(--surface-2)',
              color: 'var(--orange)',
            }}
            title="点一次发送一次"
          >
            <Send size={12} />
            发送
          </button>
        )}

        {/* 输出预览 */}
        <div
          className="rounded-md px-2 py-1.5 font-mono text-[11px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <span className="text-text-faint">输出 → </span>
          <span className="text-text-dim">{text ? `"${text.slice(0, 24)}${text.length > 24 ? '…' : ''}"` : '—'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">
            {mode === 'button'
              ? sentAt ? '已发送' : '点「发送」输出'
              : mode === 'signal'
                ? '等待外部信号'
                : running ? '正在输出文本' : '停止'}
          </span>
        </div>
      </div>
    </NodeShell>
  )
}

export const TextNode = memo(TextNodeComp)
