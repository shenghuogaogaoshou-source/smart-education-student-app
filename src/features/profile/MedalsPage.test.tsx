import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { saveAccountState } from '../../app/companionAccountRepository'
import { createLearningEvent } from '../../app/learningEvents'
import { createDefaultState } from '../../app/model'
import { MedalsPage } from './MedalsPage'

describe('medals page', () => {
  beforeEach(() => localStorage.clear())

  it('starts with only the current grade group expanded', () => {
    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('button', { name: /^5—6 年级 AI 探索实验室/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^1—2 年级 启明星大冒险/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /^3—4 年级 AI 创想大陆/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('算法徽章 · 知识')).toBeInTheDocument()
  })

  it('shows earned dates and filters without collapsing the current group', async () => {
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
    const user = userEvent.setup()
    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getAllByText('已获得 · 2026-10-20').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已获得 · 2026-10-21').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '已获得' }))

    const currentGroup = screen.getByRole('region', { name: 'AI 探索实验室勋章' })
    expect(within(currentGroup).queryByText('先去认识这个主题')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^5—6 年级 AI 探索实验室/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows medals for course progress saved before learning events were tracked', () => {
    const state = createDefaultState()
    state.learningEvents = []
    saveAccountState(state.accountId, state)

    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('button', { name: /5\s*已获得/ })).toBeInTheDocument()
  })

  it('keeps other course groups discoverable and expandable', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /^1—2 年级 启明星大冒险/ }))

    expect(screen.getByRole('region', { name: '启明星大冒险勋章' })).toBeInTheDocument()
    expect(screen.getByText('启明星守护者')).toBeInTheDocument()
  })
})
