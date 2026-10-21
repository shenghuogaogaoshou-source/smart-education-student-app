import type { Edge, Node } from 'reactflow'
import type { CircuitNodeData } from '../types/circuit'
import { getModule } from './moduleRegistry'

export interface CircuitDraft { version: 2; nodes: Node<CircuitNodeData>[]; edges: Edge[] }
const key = 'circuit-lab-draft-v1'

export function captureDraft(nodes: Node<CircuitNodeData>[], edges: Edge[]): CircuitDraft {
  return {
    version: 2,
    nodes: nodes.map(node => ({ id: node.id, type: node.type, position: { ...node.position }, data: {
      // 节点 id 也要写进 data：计数器、音量检测等有状态求值器用 data.id 做每节点状态键，
      // 只留在 node.id 上的话草稿恢复后 data.id === undefined，会退化成共享的 'anonymous'
      id: node.id,
      moduleType: node.data.moduleType, params: { ...node.data.params }, codeOverride: node.data.codeOverride,
      inputs: {}, outputs: {}, aiState: { status: 'idle' }, lastPulse: 0,
    } })),
    edges: edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle, type: edge.type,
      // 连线数据类型（fromType）挂在 edge.data 上：丢了解析后连线上就没有类型徽标/配色了
      data: edge.data ? { ...edge.data } : undefined,
    })),
  }
}

/** 模块注册表里的参数默认值（草稿里缺少的新参数用它回填） */
function defaultsOf(moduleType: string): Record<string, string | number> {
  const defaults: Record<string, string | number> = {}
  for (const p of getModule(moduleType)?.params ?? []) defaults[p.id] = p.default
  return defaults
}

export function readDraft(): CircuitDraft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    if (!raw || ![1, 2].includes(raw.version) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null
    let nodes = raw.nodes
      .filter((node: Node<CircuitNodeData>) => typeof node?.id === 'string' && node.data && getModule(node.data.moduleType) && node.data.params && Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y))
      // 旧草稿可能缺后来才加的参数：先铺注册表默认值，再用草稿里已保存的值覆盖（用户调过的值优先）
      .map((node: Node<CircuitNodeData>) => ({ ...node, data: { ...node.data, params: { ...defaultsOf(node.data.moduleType), ...node.data.params } } }))

    // v1 曾保存过一个不可运行的默认示例：Camera → ImageClassifier → IF → Output，
    // 其中 IF 目标是空串。只迁移这一种精确结构，避免改动学生自行搭建的电路。
    const starterTypes = ['camera', 'imageClassifier', 'if', 'output']
    const isLegacyStarter = nodes.length === starterTypes.length
      && starterTypes.every((type) => nodes.filter((node: Node<CircuitNodeData>) => node.data.moduleType === type).length === 1)
    if (isLegacyStarter) {
      nodes = nodes.map((node: Node<CircuitNodeData>) =>
        node.data.moduleType === 'if' && !String(node.data.params.targetLabel ?? '').trim()
          ? { ...node, data: { ...node.data, params: { ...node.data.params, targetLabel: '暗' } } }
          : node,
      )
    }
    const ids = new Set(nodes.map((node: Node) => node.id))
    return captureDraft(nodes, raw.edges.filter((edge: Edge) => edge && typeof edge.id === 'string' && ids.has(edge.source) && ids.has(edge.target)))
  } catch { return null }
}

export function saveDraft(draft: CircuitDraft): boolean {
  try { localStorage.setItem(key, JSON.stringify(draft)); return true } catch { return false }
}
