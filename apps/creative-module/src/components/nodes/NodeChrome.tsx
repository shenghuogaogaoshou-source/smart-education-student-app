// ============================================================
// NodeChrome —— 给每个画布元件套上"外壳按钮"
//   · 右上角 ✕ 直接删除该元件（不用再进检视器）
//   · 右上角 🔧 打开参数检视器（参数多的元件靠它）
// 同时通过 Context 把节点 id / 参数传给 NodeShell，让参数可以直接在元件上改
// ============================================================
import { createContext, memo, useContext, type ComponentType, type ReactNode } from 'react'
import type { NodeProps } from 'reactflow'
import { Trash2, SlidersHorizontal } from 'lucide-react'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

export interface NodeMeta {
  id: string
  params: Record<string, string | number>
}

const NodeMetaContext = createContext<NodeMeta | null>(null)

/** NodeShell 用：拿到当前节点 id 与参数（不在画布内时为 null） */
export function useNodeMeta(): NodeMeta | null {
  return useContext(NodeMetaContext)
}

function ChromeInner({ id: nodeId, params, children }: NodeMeta & { children: ReactNode }) {
  const deleteNode = useCircuit((s) => s.deleteNode)
  const requestInspector = useCircuit((s) => s.requestInspector)

  return (
    <NodeMetaContext.Provider value={{ id: nodeId, params }}>
      {children}
      <div className="node-chrome nodrag nopan">
        <button
          type="button"
          className="node-chrome-btn"
          title="打开参数检视器"
          aria-label="打开参数检视器"
          onClick={(e) => {
            e.stopPropagation()
            requestInspector(nodeId)
          }}
        >
          <SlidersHorizontal size={13} />
        </button>
        <button
          type="button"
          className="node-chrome-btn node-chrome-danger"
          title="删除该元件"
          aria-label="删除该元件"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(nodeId)
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </NodeMetaContext.Provider>
  )
}

/** 把任意节点组件包装成"带删除/编辑按钮"的版本 */
export function withNodeChrome<P extends NodeProps<CircuitNodeData>>(Comp: ComponentType<P>) {
  const Wrapped = memo((props: P) => (
    <ChromeInner id={props.id} params={(props.data?.params ?? {}) as Record<string, string | number>}>
      <Comp {...props} />
    </ChromeInner>
  ))
  Wrapped.displayName = `withNodeChrome(${(Comp as { displayName?: string; name?: string }).displayName ?? (Comp as { name?: string }).name ?? 'Node'})`
  return Wrapped as unknown as ComponentType<P>
}
