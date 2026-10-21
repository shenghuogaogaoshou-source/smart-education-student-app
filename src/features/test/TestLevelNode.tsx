import { Check, Lock, Play, Sparkles } from 'lucide-react'
import type { Ref } from 'react'
import type { CoursePart } from '../knowledge/courseCatalog'
import type { MapNode } from './testMapData'

export type TestLevelStatus = 'completed' | 'current' | 'available' | 'knowledge-locked'

const statusLabel: Record<TestLevelStatus, string> = {
  completed: '已通关',
  current: '当前关卡',
  available: '可挑战',
  'knowledge-locked': '先学知识',
}

type Props = {
  node: MapNode
  part: CoursePart
  status: TestLevelStatus
  onSelect: (part: CoursePart) => void
  buttonRef?: Ref<HTMLButtonElement>
}

export function TestLevelNode({ node, part, status, onSelect, buttonRef }: Props) {
  return (
    <article
      className={`test-level-node test-level-node--${status}`}
      style={{ left: `${node.x}%`, bottom: `${node.y}%` }}
      data-node-id={node.id}
    >
      <button
        ref={buttonRef}
        type="button"
        className="test-level-node__button"
        data-node-anchor={node.id}
        aria-label={`${part.title} · ${statusLabel[status]}`}
        aria-current={status === 'current' ? 'step' : undefined}
        onClick={() => onSelect(part)}
      >
        <span className="test-level-node__landmark" aria-hidden="true">{node.landmark}</span>
        <span className="test-level-node__state" aria-hidden="true">
          {status === 'completed' && <Check size={16} />}
          {status === 'current' && <Sparkles size={16} />}
          {status === 'available' && <Play size={15} />}
          {status === 'knowledge-locked' && <Lock size={15} />}
        </span>
      </button>
      <div className="test-level-node__copy">
        <strong>{part.title}</strong>
        <span>第 {part.number} 部分 · {statusLabel[status]}</span>
        <p>{node.detail}</p>
      </div>
    </article>
  )
}
