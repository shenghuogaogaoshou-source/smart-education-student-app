// ============================================================
// TrashClassifierNode —— 垃圾分类器（COCO-SSD 目标检测）
// 显示输出标签（鱼/垃圾）+ 检测到的物体列表
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Recycle, Fish, Trash2 } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'
import type { Detection } from '../../lib/ai/objectDetector'

// 与 evaluator 中一致的垃圾类别（用于高亮显示）
// detect() 已将英文 class 翻译为中文，这里用中文匹配
const TRASH_CLASSES = new Set(['瓶子', '杯子', '酒杯'])

function TrashClassifierNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const status = data.aiState?.status ?? 'idle'
  const hasInput = !!data.inputs.image

  const label = data.aiState?.label as string | undefined
  const isTrash = data.aiState?.isTrash as boolean | undefined
  const detections = data.aiState?.detections as Detection[] | undefined
  const message = data.aiState?.message as string | undefined

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 模型标识 */}
        <div className="flex items-center justify-between">
          <span
            className="chip rounded px-1.5 py-0.5 text-amber-dim"
            style={{ border: '1px solid var(--ink)', background: 'rgba(212,160,74,0.12)' }}
          >
            {module.model}
          </span>
          <span className="chip text-text-faint">{hasInput ? '已接收图像' : '等待图像'}</span>
        </div>

        {/* 输出标签 */}
        {hasInput && label ? (
          <div
            className="flex items-center justify-center gap-2 rounded-lg py-3"
            style={{
              border: `2px solid var(--ink)`,
              background: isTrash ? 'rgba(212,130,90,0.18)' : 'rgba(107,163,195,0.18)',
              boxShadow: '2px 2px 0 0 var(--ink)',
            }}
          >
            {isTrash ? (
              <Trash2 size={20} className="text-orange-sig" strokeWidth={2.2} />
            ) : (
              <Fish size={20} className="text-cyan-sig" strokeWidth={2.2} />
            )}
            <span
              className="handwritten text-[20px] font-bold"
              style={{ color: isTrash ? 'var(--orange)' : 'var(--cyan)' }}
            >
              {label}
            </span>
          </div>
        ) : (
          <div
            className="grid h-[60px] place-items-center rounded-lg text-center"
            style={{ border: '2px dashed var(--border-bright)' }}
          >
            <span className="chip text-text-faint">
              {status === 'running' ? 'AI 检测中…' : '连接场景相机'}
            </span>
          </div>
        )}

        {/* 检测到的物体 */}
        {detections && detections.length > 0 && (
          <div
            className="space-y-1 rounded-lg p-2"
            style={{ border: '1.5px solid var(--ink)', background: 'rgba(244,234,213,0.5)' }}
          >
            <div className="chip text-text-dim">检测到 {detections.length} 个物体</div>
            {detections.slice(0, 4).map((d, i) => {
              const isTrashObj = TRASH_CLASSES.has(d.class)
              return (
                <div key={i} className="flex items-center justify-between font-mono text-[10px]">
                  <span
                    className={isTrashObj ? 'font-bold text-orange-sig' : 'text-text-dim'}
                  >
                    {isTrashObj ? '★ ' : ''}
                    {d.class}
                  </span>
                  <span className="text-text-faint">{Math.round(d.score * 100)}%</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 消息 */}
        {message && <div className="text-center chip text-text-faint">{message}</div>}
      </div>
    </NodeShell>
  )
}

export const TrashClassifierNode = memo(TrashClassifierNodeComp)
