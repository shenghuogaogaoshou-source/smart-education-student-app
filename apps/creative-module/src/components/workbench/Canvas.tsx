// ============================================================
// Canvas —— 中央画布：React Flow 节点编辑器
// 支持从模块市场拖入、连线类型校验、选中/删除
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { ModulePalette } from './ModulePalette'
import { Inspector } from './Inspector'
import { AppPanel } from './AppPanel'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { nodeTypes } from '../nodes'
import { DataFlowEdge } from '../edges/DataFlowEdge'
import { useCircuit } from '../../store/circuitStore'
import { getModule } from '../../lib/moduleRegistry'
import { TYPE_COLOR } from '../../types/circuit'

const edgeTypes = { dataflow: DataFlowEdge }

export function Canvas() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const [marketOpen, setMarketOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const cancelPress = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }, [])
  useEffect(() => cancelPress, [cancelPress])

  const nodes = useCircuit((s) => s.nodes)
  const edges = useCircuit((s) => s.edges)
  const onNodesChange = useCircuit((s) => s.onNodesChange)
  const onEdgesChange = useCircuit((s) => s.onEdgesChange)
  const onConnect = useCircuit((s) => s.onConnect)
  const addModule = useCircuit((s) => s.addModule)
  const selectNode = useCircuit((s) => s.selectNode)
  const selectedNodeId = useCircuit((s) => s.selectedNodeId)
  const inspectorRequestId = useCircuit((s) => s.inspectorRequestId)
  const clearInspectorRequest = useCircuit((s) => s.clearInspectorRequest)
  const selectedExists = nodes.some((node) => node.id === selectedNodeId)
  useEffect(() => { if (!selectedExists) setInspectorOpen(false) }, [selectedExists])
  useEffect(() => {
    if (!inspectorRequestId) return
    setInspectorOpen(true)
    clearInspectorRequest()
  }, [clearInspectorRequest, inspectorRequestId])

  const addFromMarket = (type: string) => {
    const bounds = wrapperRef.current?.getBoundingClientRect()
    if (!bounds || !rfInstance.current) return
    const position = rfInstance.current.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
    addModule(type, position.x - 120, position.y - 60)
    setMarketOpen(false)
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/aicircuit')
      if (!type) return
      const mod = getModule(type)
      if (!mod) return
      const bounds = wrapperRef.current?.getBoundingClientRect()
      if (!bounds || !rfInstance.current) return
      const position = rfInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      addModule(type, position.x - 120, position.y - 40)
    },
    [addModule],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // 仅在 selectedNodeId 变化时映射 selected，避免每次渲染重建数组
  const decoratedNodes = useMemo(
    () => nodes.map((n) => (n.id === selectedNodeId ? { ...n, selected: true } : { ...n, selected: false })),
    [nodes, selectedNodeId],
  )

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-0 min-w-0 overflow-hidden breadboard-bg"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onPointerDownCapture={(event) => {
        cancelPress()
        if (!event.isPrimary || event.button !== 0) return
        const target = event.target as HTMLElement
        if (target.closest('button, input, textarea, select, a, .react-flow__handle, [contenteditable]')) return
        const id = target.closest('.react-flow__node')?.getAttribute('data-id')
        if (!id) return
        press.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
          selectNode(id)
          setInspectorOpen(true)
          press.current = null
        }, 550) }
      }}
      onPointerMoveCapture={(event) => {
        if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 8) cancelPress()
      }}
      onPointerUpCapture={cancelPress}
      onPointerCancelCapture={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(event) => { if ((event.target as HTMLElement).closest('.react-flow__node')) event.preventDefault() }}
    >
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(inst) => {
          rfInstance.current = inst
          // 容器尺寸就绪后再 fitView，避免节点跑出画布被侧栏覆盖
          const tryFit = (attempts = 0) => {
            const bounds = wrapperRef.current?.getBoundingClientRect()
            if (bounds && bounds.width > 1 && bounds.height > 1) {
              inst.fitView({ padding: 0.25, maxZoom: 1 })
            } else if (attempts < 12) {
              requestAnimationFrame(() => tryFit(attempts + 1))
            }
          }
          requestAnimationFrame(() => tryFit())
        }}
        onNodeClick={(_, n) => selectNode(n.id)}
        onNodeDragStart={cancelPress}
        onPaneClick={() => selectNode(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.8}
        connectOnClick
        nodeDragThreshold={8}
        defaultEdgeOptions={{ type: 'dataflow', deletable: true }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#c9b896" />
        <MiniMap
          nodeColor={(n) => {
            const mod = getModule((n.data as { moduleType?: string })?.moduleType ?? '')
            return mod?.accent ?? '#7a6a4a'
          }}
          nodeStrokeWidth={2}
          pannable
          zoomable
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {nodes.length === 0 && <EmptyHint />}
      <div className="canvas-app-actions">
        <button className="app-button market-entry" onClick={() => setMarketOpen(true)}><Plus size={19} />AI 模块市场</button>
        {selectedExists && <button className="app-button" aria-label="查看选中元件" onClick={() => setInspectorOpen(true)}><SlidersHorizontal size={18} /></button>}
      </div>
      <p className="canvas-touch-hint">长按元件查看详情 · 点击两端接口连线</p>
      {marketOpen && <AppPanel label="AI 模块市场" onClose={() => setMarketOpen(false)}>
        <ModulePalette onAdd={addFromMarket} onClose={() => setMarketOpen(false)} />
      </AppPanel>}
      {inspectorOpen && selectedExists && <AppPanel label="元件检视器" sheet onClose={() => setInspectorOpen(false)}>
        <Inspector />
      </AppPanel>}
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface/80">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <rect x="5" y="5" width="8" height="8" rx="2" stroke="#6ba3c3" strokeWidth="1.8" />
            <rect x="19" y="5" width="8" height="8" rx="2" stroke="#d4a04a" strokeWidth="1.8" />
            <rect x="5" y="19" width="8" height="8" rx="2" stroke="#8aab6e" strokeWidth="1.8" />
            <rect x="19" y="19" width="8" height="8" rx="2" stroke="#a888c7" strokeWidth="1.8" />
            <path
              d="M13 9h6M9 13v6M23 13v6M13 23h6"
              stroke="#3d3422"
              strokeWidth="1.6"
            />
          </svg>
        </div>
        <h3 className="font-mono text-[14px] font-bold text-text">搭建你的第一个 AI 电路</h3>
        <p className="mx-auto mt-1.5 max-w-[280px] text-[11.5px] leading-relaxed text-text-dim">
          点击 AI 模块市场添加 <span className="text-cyan-sig">摄像头</span> →{' '}
          <span className="text-amber">感光器</span> →{' '}
          <span className="text-green-sig">IF</span> →{' '}
          <span className="text-orange-sig">灯泡</span>，或点击"加载示例链路"一键开始。
        </p>
        <p className="mt-3 text-[10px] text-text-faint">
          真实感光算法：像素级亮度采样 · 数据不离开设备
        </p>
      </div>
    </div>
  )
}
