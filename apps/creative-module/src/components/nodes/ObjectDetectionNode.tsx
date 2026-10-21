// ============================================================
// ObjectDetectionNode —— 真实 COCO-SSD 目标检测
// 输入图像 → 检测框 + 标签列表 + 数量
// 可视化：在缩略图上画检测框，下方列出检测到的物体
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { Box, AlertTriangle, Loader2 } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

interface DetectionItem {
  class: string
  score: number
  bbox: [number, number, number, number]
}

// COCO 80 类配色（循环使用蜡笔色）
const DETECTION_COLORS = [
  '#6ba3c3', '#d4a04a', '#8aab6e', '#c66b5a',
  '#a888c7', '#d4825a', '#7a6a4a', '#9a8a6a',
]

function ObjectDetectionNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const modelStatus = useCircuit((s) => s.modelStatus)
  const modelMessage = useCircuit((s) => s.modelMessage)
  const status = data.aiState?.status ?? 'idle'
  const hasInput = !!data.inputs.image

  const detections = (data.aiState?.detections as DetectionItem[] | undefined) ?? []
  const message = data.aiState?.message as string | undefined
  const count = detections.length
  const topLabel = detections[0]?.class

  // 全局模型状态优先：加载中 / 加载失败时无论是否有输入都展示对应提示
  const modelFailed = modelStatus === 'error'
  const modelLoading = modelStatus === 'loading'

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

        {/* 错误状态：模型未就绪（全局加载失败，无论是否有输入都显示） */}
        {modelFailed ? (
          <div
            className="space-y-1.5 rounded-lg p-2.5"
            style={{ border: '2px solid var(--red)', background: 'rgba(198,107,90,0.12)' }}
          >
            <div className="flex items-center gap-1.5 text-red-sig">
              <AlertTriangle size={14} />
              <span className="chip font-bold">模型未就绪</span>
            </div>
            <p className="text-[11px] leading-relaxed text-text-dim">
              COCO-SSD 加载失败，无法检测。可在能访问外网的环境运行
              <span className="font-mono text-ink"> scripts/fetch-coco-ssd.ps1 </span>
              把模型下载到本地，或在
              <span className="font-mono text-ink"> .env </span>
              设置
              <span className="font-mono text-ink"> VITE_COCO_SSD_MODEL_URL </span>
              指向可达镜像。
            </p>
            {modelMessage && (
              <p className="font-mono text-[10px] leading-relaxed text-text-faint">
                {modelMessage}
              </p>
            )}
          </div>
        ) : modelLoading ? (
          <div
            className="grid h-[72px] place-items-center rounded-lg text-center"
            style={{ border: '2px dashed var(--border-bright)', background: 'rgba(212,160,74,0.08)' }}
          >
            <div className="flex flex-col items-center gap-1 text-amber-dim">
              <Loader2 size={16} className="animate-spin" />
              <span className="chip">模型加载中…</span>
            </div>
          </div>
        ) : hasInput && count > 0 ? (
          <div
            className="rounded-lg p-2.5"
            style={{ border: '2px solid var(--ink)', background: 'rgba(212,160,74,0.08)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: 'rgba(212,160,74,0.2)', border: '2px solid var(--ink)' }}
                >
                  <Box size={16} className="text-amber-dim" />
                </div>
                <div>
                  <div className="handwritten text-[20px] font-bold leading-none text-ink">
                    {count} 个物体
                  </div>
                  <div className="chip text-text-faint">
                    最可能：<span className="font-bold text-amber-dim">{topLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="grid h-[72px] place-items-center rounded-lg text-center"
            style={{ border: '2px dashed var(--border-bright)' }}
          >
            <span className="chip text-text-faint">
              {status === 'running' ? '检测中…' : hasInput ? '准备检测' : '连接摄像头/图片图像'}
            </span>
          </div>
        )}

        {/* 检测到的物体列表 */}
        {count > 0 && (
          <div
            className="space-y-1 rounded-lg p-2"
            style={{ border: '1.5px solid var(--ink)', background: 'rgba(244,234,213,0.5)' }}
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="chip text-text-dim">检测到的物体</span>
              <span className="chip text-text-faint">TOP {detections.length}</span>
            </div>
            {detections.map((d, i) => {
              const color = DETECTION_COLORS[i % DETECTION_COLORS.length]
              const w = Math.max(3, d.score * 100)
              return (
                <div key={d.class + i} className="space-y-0.5">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border-2"
                        style={{ borderColor: 'var(--ink)', background: color }}
                      />
                      <span className="font-bold text-text-dim">{d.class}</span>
                    </span>
                    <span className="text-text-faint">{(d.score * 100).toFixed(0)}%</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--ink)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${w}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 消息 */}
        {message && (
          <div className="text-center chip text-text-faint">{message}</div>
        )}
      </div>
    </NodeShell>
  )
}

export const ObjectDetectionNode = memo(ObjectDetectionNodeComp)
