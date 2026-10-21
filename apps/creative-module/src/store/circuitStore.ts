// ============================================================
// 电路状态 + 流式运行时引擎
// 数据沿 DAG 真实流动：Camera 采集 → 分类 → IF → 输出
// ============================================================
import { create } from 'zustand'
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow'
import { getModule } from '../lib/moduleRegistry'
import { EVALUATORS } from '../lib/evaluators'
import { canConnect, type CircuitNodeData, type Packet } from '../types/circuit'

// 非响应式：记录正在推理的节点，避免重入（丢帧）
const busy = new Set<string>()

function makeNode(type: string, id: string, x: number, y: number): Node<CircuitNodeData> {
  const mod = getModule(type)!
  const params: Record<string, string | number> = {}
  for (const p of mod.params) params[p.id] = p.default
  return {
    id,
    // 自定义模块统一使用 'custom' 节点类型渲染
    type: type.startsWith('custom_') ? 'custom' : type,
    position: { x, y },
    data: {
      moduleType: type,
      params,
      outputs: {},
      inputs: {},
      aiState: { status: 'idle' },
      lastPulse: 0,
    },
  }
}

interface CircuitState {
  nodes: Node<CircuitNodeData>[]
  edges: Edge[]
  running: boolean
  selectedNodeId: string | null
  inspectorRequestId: string | null
  modelStatus: 'idle' | 'loading' | 'ready' | 'error'
  modelMessage: string
  /** 当前推理引擎：coco-ssd(目标检测) / none */
  engine: 'coco-ssd' | 'none'
  /** 模块市场过滤：null=显示全部核心模块；string[]=仅显示这些类型（关卡模式） */
  paletteFilter: string[] | null

  setModelStatus: (s: CircuitState['modelStatus'], msg?: string) => void
  setEngine: (e: CircuitState['engine']) => void
  setPaletteFilter: (types: string[] | null) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (c: Connection) => void
  addModule: (type: string, x: number, y: number) => void
  deleteNode: (id: string) => void
  /** 删除指定连线 */
  deleteEdge: (id: string) => void
  updateParam: (nodeId: string, paramId: string, value: string | number) => void
  /** 更新节点的自定义代码（覆盖模块默认 code 模板） */
  updateCode: (nodeId: string, code: string) => void
  /** 重置节点代码为模块默认模板 */
  resetCode: (nodeId: string) => void
  selectNode: (id: string | null) => void
  /** 选中元件并请求画布打开检视器 */
  requestInspector: (id: string) => void
  clearInspectorRequest: () => void
  setRunning: (r: boolean) => void
  /** 节点组件采集到数据后调用（如摄像头出帧） */
  emitPacket: (nodeId: string, portId: string, packet: Packet) => void
  /** 用当前入端数据重新求值某节点（参数变化时） */
  reevaluate: (nodeId: string) => void
  /** 清空当前电路（节点+连线+选中），用于关卡切换 */
  resetCircuit: () => void
  /** 一键加载示例链路：Camera → ImageClassifier → IF → Output */
  loadDemoChain: () => void
}

let idCounter = 1
const nextId = (prefix: string) => `${prefix}_${idCounter++}_${Math.random().toString(36).slice(2, 6)}`

export const useCircuit = create<CircuitState>((set, get) => {
  // 内部：更新某节点 data
  const patchNode = (nodeId: string, patch: (d: CircuitNodeData) => Partial<CircuitNodeData>) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...patch(n.data) } as CircuitNodeData }
          : n,
      ),
    }))
  }

  // 内部：递归传播数据包
  const propagate = async (sourceId: string, portId: string, packet: Packet) => {
    // 1. 设置源节点输出 + 脉冲
    patchNode(sourceId, (d) => ({
      outputs: { ...d.outputs, [portId]: packet },
      lastPulse: Date.now(),
    }))

    // 2. 找到所有下游边
    const outEdges = get().edges.filter((e) => e.source === sourceId && e.sourceHandle === portId)
    if (!outEdges.length) return

    // 3. 把数据包写入每个目标节点的入端
    const targetIds = new Set<string>()
    for (const e of outEdges) {
      if (!e.targetHandle) continue
      patchNode(e.target, (d) => ({
        inputs: { ...d.inputs, [e.targetHandle!]: packet },
        lastPulse: Date.now(),
      }))
      targetIds.add(e.target)
    }

    // 4. 对每个目标节点：检查入端是否齐全 → 求值 → 递归传播
    for (const targetId of targetIds) {
      if (busy.has(targetId)) continue // 上一帧还在推理，丢帧
      const targetNode = get().nodes.find((n) => n.id === targetId)
      if (!targetNode) continue
      const mod = getModule(targetNode.data.moduleType)
      const evaluator = EVALUATORS[targetNode.data.moduleType]
      if (!mod || !evaluator) continue

      // 检查所有入端是否都有数据
      const inputs = { ...targetNode.data.inputs }
      const allReady = mod.inputs.every((p) => p.optional || inputs[p.id] !== undefined)
      if (!allReady) continue

      busy.add(targetId)
      // 运行中状态
      patchNode(targetId, () => ({ aiState: { status: 'running' } }))
      try {
        const result = await evaluator(targetNode.data, inputs)
        if (result) {
          if (result.aiState) {
            patchNode(targetId, () => ({ aiState: result.aiState }))
          }
          // 递归传播每个输出端口
          for (const [outPort, outPkt] of Object.entries(result.outputs)) {
            await propagate(targetId, outPort, outPkt)
          }
        }
      } catch (err) {
        patchNode(targetId, () => ({
          aiState: { status: 'error', message: (err as Error).message },
        }))
      } finally {
        busy.delete(targetId)
      }
    }
  }

  return {
    nodes: [],
    edges: [],
    running: false,
    selectedNodeId: null,
    inspectorRequestId: null,
    modelStatus: 'idle',
    modelMessage: '',
    engine: 'none',
    paletteFilter: null,

    setModelStatus: (s, msg = '') => set({ modelStatus: s, modelMessage: msg }),
    setEngine: (e) => set({ engine: e }),
    setPaletteFilter: (types) => set({ paletteFilter: types }),

    onNodesChange: (changes) =>
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as Node<CircuitNodeData>[] })),

    onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

    onConnect: (c) => {
      const src = get().nodes.find((n) => n.id === c.source)
      const tgt = get().nodes.find((n) => n.id === c.target)
      if (!src || !tgt) return
      const srcMod = getModule(src.data.moduleType)
      const tgtMod = getModule(tgt.data.moduleType)
      if (!srcMod || !tgtMod) return
      const srcPort = srcMod.outputs.find((p) => p.id === c.sourceHandle)
      const tgtPort = tgtMod.inputs.find((p) => p.id === c.targetHandle)
      if (!srcPort || !tgtPort) return
      if (!canConnect(srcPort.type, tgtPort.type)) return // 类型不匹配 → 拒绝连接
      if (!c.source || !c.target) return

      const edge: Edge = {
        id: nextId('e'),
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle ?? null,
        targetHandle: c.targetHandle ?? null,
        type: 'dataflow',
        data: { fromType: srcPort.type },
      }
      set((s) => ({ edges: addEdge(edge, s.edges) }))

      // 新连接建立后：若源节点已有输出数据，立即重发以驱动下游
      // （修复 microphone/textInput 等源节点"输出悬空"问题）
      const srcOutputs = src.data.outputs
      const cached = c.sourceHandle ? srcOutputs[c.sourceHandle] : undefined
      if (cached) {
        void get().emitPacket(c.source, c.sourceHandle!, cached)
      }
    },

    addModule: (type, x, y) => {
      const id = nextId(type)
      set((s) => ({ nodes: [...s.nodes, makeNode(type, id, x, y)], selectedNodeId: id }))
    },

    deleteNode: (id) =>
      set((s) => {
        // 找出所有以本节点为源的边，清空下游节点的对应输入端口
        const affectedEdges = s.edges.filter((e) => e.source === id)
        const clearedInputs = new Map<string, Record<string, undefined>>()
        for (const e of affectedEdges) {
          if (!e.targetHandle) continue
          const node = s.nodes.find((n) => n.id === e.target)
          if (!node) continue
          clearedInputs.set(e.target, { [e.targetHandle]: undefined })
        }
        return {
          nodes: s.nodes
            .filter((n) => n.id !== id)
            .map((n) => {
              const clr = clearedInputs.get(n.id)
              return clr ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, ...clr } } } : n
            }),
          edges: s.edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        }
      }),

    deleteEdge: (id) =>
      set((s) => {
        const edge = s.edges.find((e) => e.id === id)
        if (!edge || !edge.targetHandle) {
          return { edges: s.edges.filter((e) => e.id !== id) }
        }
        // 清空目标节点对应输入端口的数据，使下游状态随连线断开而复位
        return {
          edges: s.edges.filter((e) => e.id !== id),
          nodes: s.nodes.map((n) =>
            n.id === edge.target && n.data.inputs[edge.targetHandle!] !== undefined
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    inputs: { ...n.data.inputs, [edge.targetHandle!]: undefined },
                    aiState: { status: 'idle' },
                  },
                }
              : n,
          ),
        }
      }),

    updateParam: (nodeId, paramId, value) => {
      patchNode(nodeId, (d) => ({ params: { ...d.params, [paramId]: value } }))
      // IF 等同步逻辑节点：参数变化后立即用当前入端重算
      get().reevaluate(nodeId)
    },

    updateCode: (nodeId, code) => {
      patchNode(nodeId, () => ({ codeOverride: code }))
    },

    resetCode: (nodeId) => {
      patchNode(nodeId, () => ({ codeOverride: undefined }))
    },

    selectNode: (id) => set({ selectedNodeId: id }),

    requestInspector: (id) => set({ selectedNodeId: id, inspectorRequestId: id }),

    clearInspectorRequest: () => set({ inspectorRequestId: null }),

    setRunning: (r) => set({ running: r }),

    resetCircuit: () =>
      set({ nodes: [], edges: [], selectedNodeId: null, running: false }),

    emitPacket: (nodeId, portId, packet) => {
      void propagate(nodeId, portId, packet)
    },

    reevaluate: (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId)
      if (!node) return
      const mod = getModule(node.data.moduleType)
      const evaluator = EVALUATORS[node.data.moduleType]
      if (!mod || !evaluator) return
      const inputs = { ...node.data.inputs }
      if (!mod.inputs.every((p) => p.optional || inputs[p.id] !== undefined)) return
      if (busy.has(nodeId)) return
      busy.add(nodeId)
      Promise.resolve(evaluator(node.data, inputs)).then((result) => {
        if (result) {
          if (result.aiState) patchNode(nodeId, () => ({ aiState: result.aiState }))
          for (const [outPort, outPkt] of Object.entries(result.outputs)) {
            void propagate(nodeId, outPort, outPkt)
          }
        }
        busy.delete(nodeId)
      })
    },

    loadDemoChain: () => {
      const camId = nextId('camera')
      const clsId = nextId('imageClassifier')
      const ifId = nextId('if')
      const outId = nextId('output')
      const cam = makeNode('camera', camId, 40, 120)
      const cls = makeNode('imageClassifier', clsId, 360, 80)
      const ifN = makeNode('if', ifId, 720, 120)
      const out = makeNode('output', outId, 1060, 140)

      const mkEdge = (s: string, sh: string, t: string, th: string, type: string): Edge => ({
        id: nextId('e'),
        source: s,
        sourceHandle: sh,
        target: t,
        targetHandle: th,
        type: 'dataflow',
        data: { fromType: type },
      })

      set({
        nodes: [cam, cls, ifN, out],
        edges: [
          mkEdge(camId, 'image', clsId, 'image', 'image'),
          mkEdge(clsId, 'label', ifId, 'label', 'label'),
          mkEdge(ifId, 'signal', outId, 'signal', 'signal'),
        ],
        selectedNodeId: null,
      })
    },
  }
})
