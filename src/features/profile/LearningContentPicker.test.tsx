import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getGradeBand } from '../../app/learning'
import { createDefaultState } from '../../app/model'
import { getCourseForGrade } from '../knowledge/courseCatalog'
import { LearningContentPicker } from './LearningContentPicker'
import { getPlanCandidates } from './learningPlanner'

describe('LearningContentPicker', () => {
  it('shows only the active grade band and keeps locked tests selectable', async () => {
    const state = createDefaultState()
    const course = getCourseForGrade(state.grade)
    const progress = state.learningProgress[getGradeBand(state.grade)]
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <LearningContentPicker
        candidates={getPlanCandidates(course, progress)}
        selected={{ partId: 'ael-1', kind: 'knowledge' }}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('button', { name: '知识' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('AI 系统拆解站')).toBeInTheDocument()
    expect(screen.queryByText('启明星岛')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '测试' }))
    expect(screen.getAllByText('先学知识').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /测试：第一次 AI 实验/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      partId: 'ael-4',
      kind: 'test',
      unlocked: false,
    }))
  })
})
