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
import { EVALUATORS, clearEvaluatorState } from '../lib/evaluators'
import { canConnect, inputsReady, type CircuitNodeData, type Packet } from '../types/circuit'

// 非响应式：记录正在推理的节点，避免重入（丢帧）
const busy = new Set<string>()
// 推理中又被喂了新数据的节点：结束后补算一次，避免一次性信号被吞
const pendingReeval = new Set<string>()
// 每个节点连续补算的次数上限，防止环形连线自激
const retryBudget = new Map<string, number>()

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
      // 节点 id 也放进 data：求值器只能看到 data（计数器/音量按 id 存状态）
      id,
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
      if (busy.has(targetId)) {
        // 上一帧还在推理：记一笔待补算，推理结束后用最新入端再算一次，
        // 否则一次性信号源（定时器脉冲、单次识别结果）的这一帧会被永久丢掉
        pendingReeval.add(targetId)
        continue
      }
      const targetNode = get().nodes.find((n) => n.id === targetId)
      if (!targetNode) continue
      const mod = getModule(targetNode.data.moduleType)
      const evaluator = EVALUATORS[targetNode.data.moduleType]
      if (!mod || !evaluator) continue

      // 检查入端是否就绪（optional 端口不接线也可求值）
      const inputs = { ...targetNode.data.inputs }
      if (!inputsReady(mod.inputs, inputs)) continue

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
        // 终端模块（灯泡/LED/蜂鸣器）的求值器返回 null：不能让它停在"推理中"
        patchNode(targetId, (d) =>
          d.aiState?.status === 'running' ? { aiState: { ...d.aiState, status: 'ready' } } : {},
        )
      } catch (err) {
        patchNode(targetId, () => ({
          aiState: { status: 'error', message: (err as Error).message },
        }))
      } finally {
        busy.delete(targetId)
        if (pendingReeval.delete(targetId)) {
          // 补算次数有上限（2 次）：环形连线会让"补算→再传播→又排队"无限自激
          const used = retryBudget.get(targetId) ?? 0
          if (used < 2) {
            retryBudget.set(targetId, used + 1)
            void get().reevaluate(targetId)
          } else {
            retryBudget.delete(targetId)
          }
        } else {
          retryBudget.delete(targetId)
        }
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

    // 键盘 Delete / React Flow 自带删除走的是 changes 通道，必须和 deleteNode / deleteEdge
    // 做同样的下游复位，否则删掉的元件仍会留下下游的旧输入与“灯泡常亮”之类的残留状态
    onNodesChange: (changes) =>
      set((s) => {
        const removed = changes
          .filter((c): c is { id: string; type: 'remove' } => c.type === 'remove')
          .map((c) => c.id)
        if (!removed.length) {
          return { nodes: applyNodeChanges(changes, s.nodes) as Node<CircuitNodeData>[] }
        }
        const removedSet = new Set(removed)
        let nodes = s.nodes.filter((n) => !removedSet.has(n.id))
        const edges = s.edges.filter((e) => !removedSet.has(e.source) && !removedSet.has(e.target))
        for (const id of removed) {
          clearEvaluatorState(id)
          busy.delete(id)
          const clr: Record<string, Record<string, undefined>> = {}
          for (const e of s.edges) {
            if (e.source !== id || !e.targetHandle) continue
            clr[e.target] = { ...(clr[e.target] ?? {}), [e.targetHandle]: undefined }
          }
          nodes = nodes.map((n) =>
            clr[n.id] ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, ...clr[n.id] } } } : n,
          )
        }
        const rest = changes.filter((c) => c.type !== 'remove')
        return {
          nodes: applyNodeChanges(rest, nodes) as Node<CircuitNodeData>[],
          edges,
          selectedNodeId:
            s.selectedNodeId && removedSet.has(s.selectedNodeId) ? null : s.selectedNodeId,
        }
      }),

    onEdgesChange: (changes) =>
      set((s) => {
        // 被删掉的连线：目标节点的对应入端要清空（与 deleteEdge 行为一致）
        const removed = changes
          .filter((c): c is { id: string; type: 'remove' } => c.type === 'remove')
          .map((c) => c.id)
        if (!removed.length) return { edges: applyEdgeChanges(changes, s.edges) }

        const cleared = new Map<string, Record<string, undefined>>()
        for (const id of removed) {
          const edge = s.edges.find((e) => e.id === id)
          if (!edge || !edge.targetHandle) continue
          cleared.set(edge.target, {
            ...(cleared.get(edge.target) ?? {}),
            [edge.targetHandle]: undefined,
          })
        }
        return {
          edges: applyEdgeChanges(changes, s.edges),
          nodes: s.nodes.map((n) => {
            const clr = cleared.get(n.id)
            if (!clr) return n
            return {
              ...n,
              data: { ...n.data, inputs: { ...n.data.inputs, ...clr }, aiState: { status: 'idle' } },
            }
          }),
        }
      }),

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
          // 同一目标节点可能有多条边（多个入端），需要合并而不是覆盖
          clearedInputs.set(e.target, {
            ...(clearedInputs.get(e.target) ?? {}),
            [e.targetHandle]: undefined,
          })
        }
        // 节点被删：它自己的求值器内部状态（计数、音量窗口）一并清掉
        clearEvaluatorState(id)
        busy.delete(id)
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

    setRunning: (r) =>
      set((s) =>
        r
          ? { running: true }
          : // 停止时清掉脉冲时间戳：否则连线的“数据流动”动画会一直跑下去
            {
              running: false,
              nodes: s.nodes.map((n) => ({ ...n, data: { ...n.data, lastPulse: 0 } })),
            },
      ),

    resetCircuit: () => {
      // 清空画布：同时复位求值器内部状态与 busy 锁，避免换关卡后计数/窗口继承旧数据
      clearEvaluatorState()
      busy.clear()
      pendingReeval.clear()
      retryBudget.clear()
      set({ nodes: [], edges: [], selectedNodeId: null, running: false })
    },

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
      if (!inputsReady(mod.inputs, inputs)) return
      if (busy.has(nodeId)) return
      busy.add(nodeId)
      Promise.resolve()
        .then(() => evaluator(node.data, inputs))
        .then((result) => {
          if (!result) {
            // 终端模块返回 null：把"推理中"状态收尾，否则节点状态会一直卡住
            patchNode(nodeId, (d) =>
              d.aiState?.status === 'running' ? { aiState: { ...d.aiState, status: 'ready' } } : {},
            )
            return
          }
          if (result.aiState) patchNode(nodeId, () => ({ aiState: result.aiState }))
          for (const [outPort, outPkt] of Object.entries(result.outputs)) {
            void propagate(nodeId, outPort, outPkt)
          }
        })
        // 求值抛错也必须解锁，否则该节点会被 busy 永久挡住（画布“卡死”）
        .catch((err: Error) => {
          patchNode(nodeId, () => ({ aiState: { status: 'error', message: err?.message ?? '求值失败' } }))
        })
        .finally(() => busy.delete(nodeId))
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

      // 示例链路必须是"能亮"的：感光器输出「亮 / 暗」，IF 的默认目标标签是空串
      // （空串永远不匹配），所以这里显式设成「暗」——光线暗 → IF 输出真信号 → 灯泡点亮
      ifN.data.params = { ...ifN.data.params, targetLabel: '暗' }

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
