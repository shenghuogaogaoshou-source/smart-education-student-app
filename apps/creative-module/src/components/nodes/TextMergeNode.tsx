// ============================================================
// TextMergeNode —— 文本合并（连接符 / 模板占位符）
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Link2 } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function TextMergeNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const t1 = data.inputs.text1
  const t2 = data.inputs.text2
  const t3 = data.inputs.text3
  const hasInput = !!(t1?.type === 'text' || t2?.type === 'text' || t3?.type === 'text')
  const merged = data.aiState?.merged as string | undefined
  const p1 = t1?.type === 'text' ? String(t1.value) : undefined
  const p2 = t2?.type === 'text' ? String(t2.value) : undefined
  const p3 = t3?.type === 'text' ? String(t3.value) : undefined

  return (
    <NodeShell module={module} selected={selected} status={hasInput ? 'ready' : 'idle'}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Link2 size={14} className="text-purple-700" />
          <span className="chip text-text-faint">
            {hasInput ? '合并中' : '等待文本'}
          </span>
        </div>
        {/* 输入端预览 */}
        <div className="space-y-1 rounded-lg p-2" style={{ border: '1.5px dashed var(--border-bright)' }}>
          <div className="flex items-start gap-1.5 font-mono text-[11px]">
            <span className="chip text-text-faint" style={{ minWidth: 36 }}>1</span>
            <span className="flex-1 truncate">{p1 || <em className="text-text-faint">空</em>}</span>
          </div>
          <div className="flex items-start gap-1.5 font-mono text-[11px]">
            <span className="chip text-text-faint" style={{ minWidth: 36 }}>2</span>
            <span className="flex-1 truncate">{p2 || <em className="text-text-faint">空</em>}</span>
          </div>
          <div className="flex items-start gap-1.5 font-mono text-[11px]">
            <span className="chip text-text-faint" style={{ minWidth: 36 }}>3</span>
            <span className="flex-1 truncate">{p3 || <em className="text-text-faint">空</em>}</span>
          </div>
        </div>
        {/* 输出 */}
        <div
          className="rounded-lg p-2"
          style={{
            border: '2px solid var(--ink)',
            background: merged ? 'rgba(109,40,217,0.08)' : 'var(--surface-3)',
            minHeight: 48,
          }}
        >
          <div className="chip text-text-faint mb-1">合并结果</div>
          <div className="font-mono text-[12px] leading-snug">
            {merged || <span className="text-text-faint">尚未输出</span>}
          </div>
        </div>
      </div>
    </NodeShell>
  )
}

export const TextMergeNode = memo(TextMergeNodeComp)
