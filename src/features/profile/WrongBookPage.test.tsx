import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState, saveAccountState } from '../../app/companionAccountRepository'
import { createDefaultState, type WrongAnswerRecord } from '../../app/model'
import { WrongBookPage } from './WrongBookPage'

const wrongAnswer: WrongAnswerRecord = {
  id: 'grade5-6:ael-4:ael-4-q1',
  gradeBand: 'grade5-6',
  partId: 'ael-4',
  questionId: 'ael-4-q1',
  prompt: '一次完整的小实验通常包含什么？',
  options: ['只采一张照片', '采集、训练、测试和改进'],
  selectedIndex: 0,
  answerIndex: 1,
  explanation: '完整实验需要采集、训练、测试和改进。',
  occurredAt: '2026-10-26T09:00:00.000Z',
  correctedAt: null,
}

function seedWrongBook(records: WrongAnswerRecord[] = [wrongAnswer]) {
  const state = createDefaultState()
  state.wrongAnswers = records
  saveAccountState(state.accountId, state)
}

describe('wrong book', () => {
  beforeEach(() => localStorage.clear())

  it('renders only persisted quiz answers for the active account', () => {
    seedWrongBook()
    render(<AppStateProvider><WrongBookPage onBack={() => undefined} /></AppStateProvider>)

    expect(screen.getByText('一次完整的小实验通常包含什么？')).toBeInTheDocument()
    expect(screen.queryByText('数据质量会影响什么？')).not.toBeInTheDocument()
  })

  it('only completes correction after the child chooses the right answer', async () => {
    seedWrongBook()
    const user = userEvent.setup()
    render(<AppStateProvider><WrongBookPage onBack={() => undefined} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '重做' }))
    await user.click(screen.getByRole('button', { name: '只采一张照片' }))
    expect(screen.getByText('再想一想，你已经更接近答案了')).toBeInTheDocument()

    let saved = loadAccountState(createDefaultState().accountId)
    expect(saved.wrongAnswers[0].correctedAt).toBeNull()
    expect(saved.learningEvents).toEqual([])

    await user.click(screen.getByRole('button', { name: '采集、训练、测试和改进' }))
    await waitFor(() => {
      saved = loadAccountState(createDefaultState().accountId)
      expect(saved.wrongAnswers[0].correctedAt).not.toBeNull()
      expect(saved.learningEvents).toEqual([
        expect.objectContaining({
          action: 'correction-completed',
          contentId: wrongAnswer.id,
          source: 'correction',
        }),
      ])
    })

    const correctedAt = saved.wrongAnswers[0].correctedAt
    await user.click(screen.getByRole('button', { name: '重做' }))
    await user.click(screen.getByRole('button', { name: '采集、训练、测试和改进' }))
    await waitFor(() => {
      saved = loadAccountState(createDefaultState().accountId)
      expect(saved.wrongAnswers[0].correctedAt).toBe(correctedAt)
      expect(saved.learningEvents).toHaveLength(1)
    })
  })

  it('filters completed corrections without deleting their record', async () => {
    seedWrongBook([{ ...wrongAnswer, correctedAt: '2026-10-26T10:00:00.000Z' }])
    const user = userEvent.setup()
    render(<AppStateProvider><WrongBookPage onBack={() => undefined} /></AppStateProvider>)

    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '待复习' }))
    expect(screen.queryByText(wrongAnswer.prompt)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '已复习' }))
    expect(screen.getByText(wrongAnswer.prompt)).toBeInTheDocument()
    expect(loadAccountState(createDefaultState().accountId).wrongAnswers).toHaveLength(1)
  })
})
