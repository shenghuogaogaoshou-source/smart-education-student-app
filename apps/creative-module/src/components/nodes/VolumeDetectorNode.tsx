// ============================================================
// VolumeDetectorNode —— 音量检测（0~100 + 超阈值）
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { BarChart3, Volume2 } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function VolumeDetectorNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const audioPkt = data.inputs.audio
  const hasAudio = !!audioPkt && audioPkt.type === 'audio'
  const state = data.aiState
  const volume = Number(state?.volume ?? 0)
  const threshold = Number(data.params.threshold ?? 60)
  const isLoud = !!state?.isLoud

  return (
    <NodeShell module={module} selected={selected} status={state?.status as any}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">{hasAudio ? '音频已接入' : '等待音频'}</span>
          <span
            className="chip font-bold"
            style={{ color: isLoud ? 'var(--orange-sig)' : 'var(--text-dim)' }}
          >
            {isLoud ? '⚠️ 超限' : '✓ 正常'}
          </span>
        </div>

        {/* 音量表 */}
        <div
          className="rounded-lg p-3"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-3)' }}
        >
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-text-faint">实时音量</span>
            <span className="flex items-center gap-1">
              <Volume2 size={12} />
              <span className="font-bold">{volume}</span>
              <span className="text-text-faint">/ 100</span>
            </span>
          </div>
          {/* 模拟 VU-meter */}
          <div
            className="mt-2 grid h-4 grid-cols-20 gap-[2px] rounded"
            style={{ background: 'var(--surface-2)', padding: 2 }}
          >
            {Array.from({ length: 20 }).map((_, i) => {
              const activated = (i + 1) / 20 <= volume / 100
              const warn = (i + 1) / 20 >= threshold / 100
              return (
                <div
                  key={i}
                  className="rounded-[2px] transition-colors duration-100"
                  style={{
                    background: activated
                      ? warn
                        ? '#F97316'
                        : '#3B82F6'
                      : 'var(--border)',
                    opacity: activated ? 1 : 0.5,
                  }}
                />
              )
            })}
          </div>
          {/* 阈值线标签 */}
          <div
            className="mt-1 text-right font-mono text-[10px]"
            style={{ color: '#F97316' }}
          >
            阈值线 ↑ {threshold}
          </div>
        </div>

        {state?.message && (
          <div className="chip text-text-dim">{String(state.message)}</div>
        )}
        {/* 防止 tree-shaking 图标丢失 */}
        <span className="hidden"><BarChart3 size={12} /></span>
      </div>
    </NodeShell>
  )
}

export const VolumeDetectorNode = memo(VolumeDetectorNodeComp)
