// ============================================================
// PhotosensorNode —— 感光器（原名 ImageClassifier）
// 读取画面平均亮度 → 0~100% 亮度值 + 亮/暗二档标签
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Sun, Moon } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function PhotosensorNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const status = data.aiState?.status ?? 'idle'
  const hasInput = !!data.inputs.image

  const brightnessPct = Number(data.aiState?.brightnessPct ?? 0)
  const threshold = Number(data.aiState?.threshold ?? Number(data.params.threshold ?? 50))
  const label = data.aiState?.label as '亮' | '暗' | undefined
  const rgb = data.aiState?.rgb as { r: number; g: number; b: number } | undefined
  const message = data.aiState?.message as string | undefined

  // 显示色：根据亮度从暗（深靛蓝）渐变到亮（姜黄）
  const bright = brightnessPct / 100
  const barColor = label === '亮' ? '#d4a04a' : '#6ba3c3'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 模型标识 */}
        <div className="flex items-center justify-between">
          <span className="chip rounded px-1.5 py-0.5 text-amber-dim"
            style={{ border: '1px solid var(--ink)', background: 'rgba(212,160,74,0.12)' }}
          >
            {module.model}
          </span>
          <span className="chip text-text-faint">{hasInput ? '已接收图像' : '等待图像'}</span>
        </div>

        {/* 亮度大表头：亮/暗图标 + 数值 */}
        <div
          className="relative overflow-hidden rounded-lg p-3 transition-all"
          style={{
            border: '2px solid var(--ink)',
            background: rgb
              ? `linear-gradient(180deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.18), rgba(${rgb.r},${rgb.g},${rgb.b},0.06))`
              : 'var(--surface-3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="grid h-10 w-10 place-items-center rounded-xl transition-all"
                style={{
                  background: label === '亮' ? '#d4a04a' : '#6ba3c3',
                  border: '2px solid var(--ink)',
                  boxShadow: label === '亮' ? '0 0 14px rgba(212,160,74,0.6)' : 'none',
                }}
              >
                {label === '亮' ? (
                  <Sun size={18} style={{ color: '#fdf6e3' }} />
                ) : (
                  <Moon size={18} style={{ color: '#fdf6e3' }} />
                )}
              </div>
              <div>
                <div className="handwritten text-[22px] font-bold leading-none text-ink">
                  {label ?? '—'}
                </div>
                <div className="chip text-text-faint">
                  {message ?? '（等待感光）'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="handwritten text-[28px] font-bold leading-none"
                style={{ color: barColor }}
              >
                {brightnessPct}
              </div>
              <div className="chip text-text-faint">亮度 %</div>
            </div>
          </div>
        </div>

        {/* 亮度表（带阈值标记线） */}
        {hasInput ? (
          <div
            className="space-y-1.5 rounded-lg p-2"
            style={{ border: '1.5px solid var(--ink)', background: 'rgba(244,234,213,0.5)' }}
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="chip text-text-dim">亮度分布</span>
              <span className="chip text-text-faint">阈值 {threshold}%</span>
            </div>
            <div className="relative">
              <div
                className="h-3.5 overflow-hidden rounded-full"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--ink)' }}
              >
                {/* 渐变填充：靛蓝 → 橄榄 → 姜黄 */}
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${brightnessPct}%`,
                    background: 'linear-gradient(90deg, #6ba3c3 0%, #8aab6e 55%, #d4a04a 100%)',
                  }}
                />
              </div>
              {/* 阈值标记线 */}
              <div
                className="absolute top-0 h-3.5 w-[2px] -translate-x-1/2"
                style={{
                  left: `${threshold}%`,
                  background: '#c66b5a',
                  boxShadow: '0 0 0 1px var(--surface)',
                }}
                title={`阈值 ${threshold}%`}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-text-faint">
              <span>0 暗</span>
              <span style={{ color: '#c66b5a' }}>◄阈值►</span>
              <span>100 亮</span>
            </div>
          </div>
        ) : (
          <div
            className="grid h-[64px] place-items-center rounded-lg text-center"
            style={{ border: '2px dashed var(--border-bright)' }}
          >
            <span className="chip text-text-faint">
              {status === 'running' ? '测光中…' : '连接摄像头/图片图像'}
            </span>
          </div>
        )}
      </div>
    </NodeShell>
  )
}

export const ImageClassifierNode = memo(PhotosensorNodeComp)
