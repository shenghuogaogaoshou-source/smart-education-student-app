import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { saveAccountState } from '../../app/companionAccountRepository'
import { createLearningEvent } from '../../app/learningEvents'
import { createDefaultState } from '../../app/model'
import { PointsPage } from './PointsPage'
import { RewardsSection } from './RewardsSection'

describe('profile rewards', () => {
  beforeEach(() => localStorage.clear())

  it('shows earned medals against the fixed 49-course-medal total', () => {
    const state = createDefaultState()
    state.learningEvents = [
      createLearningEvent({
        accountId: state.accountId,
        gradeBand: 'grade5-6',
        source: 'knowledge',
        contentId: 'ael-1',
        action: 'knowledge-completed',
        occurredAt: '2026-10-20T09:00:00.000Z',
      }),
      createLearningEvent({
        accountId: state.accountId,
        gradeBand: 'grade5-6',
        source: 'test',
        contentId: 'ael-1',
        action: 'test-passed',
        occurredAt: '2026-10-21T09:00:00.000Z',
      }),
    ]
    saveAccountState(state.accountId, state)

    render(
      <AppStateProvider>
        <RewardsSection />
      </AppStateProvider>,
    )

    expect(screen.getByText('我的勋章').closest('button')).toHaveTextContent('2 / 49 枚')
  })

  it('starts at zero for the new event-based medal system', () => {
    render(
      <AppStateProvider>
        <RewardsSection />
      </AppStateProvider>,
    )

    expect(screen.getByText('我的勋章').closest('button')).toHaveTextContent('0 / 49 枚')
  })

  it('renders totals and records from the same 2000-point ledger', () => {
    render(<AppStateProvider><PointsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('2,000')
    expect(screen.getByText('累计获得').parentElement).toHaveTextContent('+2,000')
    expect(screen.getByText('累计消耗').parentElement).toHaveTextContent('-0')
    expect(screen.getByText('成长体验账号启航积分')).toBeInTheDocument()
    expect(screen.queryByText(/星空精灵/)).not.toBeInTheDocument()
  })
})
