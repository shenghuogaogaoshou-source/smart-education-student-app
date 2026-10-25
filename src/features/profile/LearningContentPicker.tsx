import { BookOpen, FlaskConical, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PlanCandidate } from './learningPlanner'

export type PlanCandidateSelection = Pick<PlanCandidate, 'partId' | 'kind'>

type LearningContentPickerProps = {
  candidates: PlanCandidate[]
  selected: PlanCandidateSelection
  onSelect: (candidate: PlanCandidate) => void
}

export function LearningContentPicker({ candidates, selected, onSelect }: LearningContentPickerProps) {
  const [kind, setKind] = useState<PlanCandidate['kind']>(selected.kind)

  useEffect(() => setKind(selected.kind), [selected.kind])

  const visibleCandidates = candidates.filter((candidate) => candidate.kind === kind)

  return (
    <div className="schedule-picker">
      <div className="schedule-picker-tabs" aria-label="学习内容类型">
        <button
          type="button"
          aria-pressed={kind === 'knowledge'}
          onClick={() => setKind('knowledge')}
        >
          <BookOpen aria-hidden="true" size={16} />
          知识
        </button>
        <button
          type="button"
          aria-pressed={kind === 'test'}
          onClick={() => setKind('test')}
        >
          <FlaskConical aria-hidden="true" size={16} />
          测试
        </button>
      </div>
      <div className="schedule-picker-list" aria-label={kind === 'knowledge' ? '知识内容' : '测试内容'}>
        {visibleCandidates.map((candidate) => {
          const active = candidate.partId === selected.partId && candidate.kind === selected.kind
          const accessibleState = [
            candidate.review ? '复习' : '',
            !candidate.unlocked ? '先学知识' : '',
          ].filter(Boolean).join('，')
          return (
            <button
              className="schedule-picker-item"
              type="button"
              key={`${candidate.partId}-${candidate.kind}`}
              aria-pressed={active}
              aria-label={`${kind === 'knowledge' ? '知识' : '测试'}：${candidate.title}${accessibleState ? `，${accessibleState}` : ''}`}
              onClick={() => onSelect(candidate)}
            >
              <span className="schedule-picker-number">{candidate.partNumber}</span>
              <span className="schedule-picker-copy">
                <strong>{candidate.title}</strong>
                <small>{candidate.review ? '已经探索过，可以再回顾一次' : `建议 ${candidate.suggestedMinutes} 分钟`}</small>
              </span>
              <span className="schedule-picker-tags">
                {candidate.review && <span>复习</span>}
                {!candidate.unlocked && <span className="is-locked"><LockKeyhole aria-hidden="true" size={11} />先学知识</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
