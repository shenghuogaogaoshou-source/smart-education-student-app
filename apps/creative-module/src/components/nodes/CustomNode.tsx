// ============================================================
// CustomNode —— 自定义模块的通用渲染节点
// 根据 inputs/outputs 端口定义动态展示数据流和状态
// ============================================================
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { getCustomModule } from '../../lib/customModules'
import type { CircuitNodeData, Packet } from '../../types/circuit'

/** 格式化 Packet 为简短展示文本 */
function fmtPacket(pkt: Packet | undefined): string {
  if (!pkt) return '—'
  switch (pkt.type) {
    case 'label':
    case 'text':
      return String(pkt.value)
    case 'confidence':
    case 'number':
      return typeof pkt.value === 'number' ? pkt.value.toFixed(2) : String(pkt.value)
    case 'signal':
      return pkt.active ? 'TRUE' : 'FALSE'
    case 'image':
      return '[图像]'
    case 'audio':
      return '[音频]'
    default:
      return '—'
  }
}

function CustomNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const def = getCustomModule(data.moduleType)
  const status = data.aiState?.status ?? 'idle'
  const message = data.aiState?.message as string | undefined

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 输入值展示 */}
        {def && def.inputs.length > 0 && (
          <div className="space-y-1">
            {def.inputs.map((p) => {
              const pkt = data.inputs[p.id]
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 font-mono text-[11px]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span className="text-text-faint">{p.label}</span>
                  <span className="text-text-dim">{fmtPacket(pkt)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 输出值展示 */}
        {def && def.outputs.length > 0 && (
          <div className="space-y-1">
            {def.outputs.map((p) => {
              const pkt = data.outputs[p.id]
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 font-mono text-[11px]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <span className="text-text-faint">→ {p.label}</span>
                  <span className="font-bold text-text">{fmtPacket(pkt)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 状态消息 */}
        {message && (
          <div
            className="rounded-md px-2 py-1 text-center font-mono text-[11px] font-bold transition-all"
            style={{
              background:
                status === 'error'
                  ? 'rgba(198,107,90,0.12)'
                  : status === 'ready'
                    ? 'rgba(138,171,110,0.12)'
                    : 'rgba(154,138,106,0.08)',
              border: `1.5px solid ${
                status === 'error'
                  ? 'var(--red)'
                  : status === 'ready'
                    ? 'var(--green)'
                    : 'var(--border-bright)'
              }`,
              color:
                status === 'error'
                  ? 'var(--red-sig)'
                  : status === 'ready'
                    ? 'var(--green-sig)'
                    : 'var(--text-faint)',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </NodeShell>
  )
}

export const CustomNode = memo(CustomNodeComp)
