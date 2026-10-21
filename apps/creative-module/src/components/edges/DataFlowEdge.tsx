// ============================================================
// DataFlowEdge —— 带数据流动画的自定义连线
// 源节点刚"脉冲"过 → 亮色流动虚线；否则暗色静态
// 悬停时显示 × 删除按钮
// ============================================================
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow'
import { X } from 'lucide-react'
import { useCircuit } from '../../store/circuitStore'
import { TYPE_COLOR } from '../../types/circuit'
import type { EdgeProps } from 'reactflow'

export function DataFlowEdge({
  id,
  source,
  sourceHandleId,
  targetX,
  targetY,
  sourceX,
  sourceY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const sourceNode = useCircuit((s) => s.nodes.find((n) => n.id === source))
  const running = useCircuit((s) => s.running)
  const deleteEdge = useCircuit((s) => s.deleteEdge)

  const color = data?.fromType ? TYPE_COLOR[data.fromType as keyof typeof TYPE_COLOR] : '#7a6a4a'
  const lastPulse = sourceNode?.data.lastPulse ?? 0
  const active =
    running && Date.now() - lastPulse < 900 && !!sourceNode?.data.outputs[sourceHandleId ?? '']

  return (
    <>
      {/* 底层暗线 —— 蜡笔墨色 */}
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#7a6a4a', strokeWidth: 2.6, strokeLinecap: 'round' }} />
      {/* 数据类型彩色覆盖线 —— 蜡笔水彩色 */}
      <BaseEdge
        id={`${id}-color`}
        path={edgePath}
        style={{
          stroke: active ? color : `${color}66`,
          strokeWidth: active ? 3 : 2,
          transition: 'stroke 0.2s, stroke-width 0.2s',
          strokeLinecap: 'round',
        }}
      />
      {/* 流动虚线（仅 active 时）—— 蜡笔白点流动 */}
      {active && (
        <BaseEdge
          id={`${id}-flow`}
          path={edgePath}
          style={{
            stroke: '#fff8e0',
            strokeWidth: 2.4,
            strokeDasharray: '5 11',
            animation: 'flowDash 0.9s linear infinite',
            opacity: 0.9,
            strokeLinecap: 'round',
          }}
        />
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan group"
        >
          <div className="flex items-center gap-0.5">
            <span
              className="chip rounded px-1.5 py-0.5 font-bold"
              style={{
                color,
                background: 'rgba(253,246,227,0.95)',
                border: `1.5px solid var(--ink)`,
                opacity: active ? 1 : 0.6,
                transition: 'opacity .2s',
              }}
            >
              {data?.fromType ? TYPE_LABEL_SHORT[data.fromType as keyof typeof TYPE_LABEL_SHORT] : ''}
            </span>
            {/* 删除按钮：悬停连线时出现 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteEdge(id)
              }}
              className="grid h-5 w-5 place-items-center rounded-full border-[1.5px] border-ink bg-surface opacity-0 transition-all hover:bg-red-sig/20 group-hover:opacity-100"
              title="删除连线"
            >
              <X size={11} className="text-text-dim" />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const TYPE_LABEL_SHORT: Record<string, string> = {
  image: 'IMG',
  label: 'LBL',
  confidence: 'CONF',
  signal: 'SIG',
  text: 'TXT',
  number: 'NUM',
}
