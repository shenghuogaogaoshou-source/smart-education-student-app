import type { Edge, Node } from 'reactflow'
import type { CircuitNodeData } from '../types/circuit'
import { getModule } from './moduleRegistry'

export interface CircuitDraft { version: 1; nodes: Node<CircuitNodeData>[]; edges: Edge[] }
const key = 'circuit-lab-draft-v1'

export function captureDraft(nodes: Node<CircuitNodeData>[], edges: Edge[]): CircuitDraft {
  return {
    version: 1,
    nodes: nodes.map(node => ({ id: node.id, type: node.type, position: { ...node.position }, data: {
      moduleType: node.data.moduleType, params: { ...node.data.params }, codeOverride: node.data.codeOverride,
      inputs: {}, outputs: {}, aiState: { status: 'idle' }, lastPulse: 0,
    } })),
    edges: edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle, type: edge.type })),
  }
}

export function readDraft(): CircuitDraft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    if (!raw || raw.version !== 1 || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null
    const nodes = raw.nodes.filter((node: Node<CircuitNodeData>) => typeof node?.id === 'string' && node.data && getModule(node.data.moduleType) && node.data.params && Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y))
    const ids = new Set(nodes.map((node: Node) => node.id))
    return captureDraft(nodes, raw.edges.filter((edge: Edge) => edge && typeof edge.id === 'string' && ids.has(edge.source) && ids.has(edge.target)))
  } catch { return null }
}

export function saveDraft(draft: CircuitDraft): boolean {
  try { localStorage.setItem(key, JSON.stringify(draft)); return true } catch { return false }
}
