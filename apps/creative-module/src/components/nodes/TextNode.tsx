// ============================================================
// TextNode —— 文本输入
// 学生输入文字 → emitPacket 推入电路（作为 AI 的文本输入）
// ============================================================
import { memo, useEffect } from 'react'
import { NodeProps } from 'reactflow'
import { Type } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

function TextNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)
  const updateParam = useCircuit((s) => s.updateParam)

  const text = String(data.params.text ?? '')

  // 运行时：输出当前文本（running 或 text 变化时输出一次）
  useEffect(() => {
    if (running && text) {
      emitPacket(id, 'text', { type: 'text', value: text, ts: Date.now() })
    }
  }, [running, text, id, emitPacket])

  const status = running ? 'running' : 'idle'

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
            {running ? '正在输出文本' : '停止'}
          </span>
        </div>
      </div>
    </NodeShell>
  )
}

export const TextNode = memo(TextNodeComp)
