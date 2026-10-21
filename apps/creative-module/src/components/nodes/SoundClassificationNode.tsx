// ============================================================
// SoundClassificationNode —— 声音分类
// 接收 audio → evaluator 输出 5 类标签 + 置信度
// ============================================================
import { memo, useEffect, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Music4 } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function SoundClassificationNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const audioPkt = data.inputs.audio
  const hasAudio = !!audioPkt && audioPkt.type === 'audio'
  const state = data.aiState
  const [barKey, setBarKey] = useState(0)

  useEffect(() => { setBarKey((k) => k + 1) }, [data.aiState?.topClass])

  const labels = String(data.params.classes ?? '拍手,说话,笑声,安静,噪音').split(',').map((s) => s.trim()).filter(Boolean)
  const topCls = state?.topClass as string | undefined
  const conf = Number(state?.confidence ?? 0)

  return (
    <NodeShell module={module} selected={selected} status={state?.status as any}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Music4 size={14} className="text-blue-500" />
            <span className="chip text-text-faint">{hasAudio ? '音频已接入' : '等待音频'}</span>
          </div>
          <span className="chip text-text-faint">{labels.length} 类</span>
        </div>

        {/* 结果卡片 */}
        <div
          className="rounded-lg p-3"
          style={{
            border: '2px solid var(--ink)',
            background: topCls ? 'rgba(59,130,246,0.08)' : 'var(--surface-3)',
          }}
        >
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-text-faint">当前判定</span>
            <span className={topCls ? 'font-bold text-ink' : 'text-text-faint'}>
              {topCls || '——'}
            </span>
          </div>
          {/* 置信度条 */}
          <div
            key={barKey}
            className="mt-2 h-2 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${(conf * 100).toFixed(0)}%`, background: '#3B82F6' }}
            />
          </div>
          <div className="mt-1 text-right font-mono text-[10px] text-text-dim">
            {(conf * 100).toFixed(0)}%
          </div>
        </div>

        {/* 消息 */}
        {state?.message && (
          <div className="chip text-text-dim">{String(state.message)}</div>
        )}
      </div>
    </NodeShell>
  )
}

export const SoundClassificationNode = memo(SoundClassificationNodeComp)
