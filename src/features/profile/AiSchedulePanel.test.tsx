import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BandProgress, PrimaryGrade } from '../../app/learning'
import { createDefaultState } from '../../app/model'
import type { DailyAvailability, LearningPlanTask } from '../../app/learningPlan'
import { getCourseForGrade } from '../knowledge/courseCatalog'
import { AiSchedulePanel } from './AiSchedulePanel'
import { ScheduleSuggestionError, type ScheduleSuggestionRequest, type ScheduleSuggestionResult } from './scheduleApi'

const state = createDefaultState()
const course = getCourseForGrade(state.grade)
const progress = state.learningProgress[course.band]

function suggestion(overrides: Partial<LearningPlanTask> = {}): LearningPlanTask {
  const day = state.learningPlan.availability[1].date
  const now = new Date().toISOString()
  return {
    id: 'ai-suggested',
    grade: state.grade,
    partId: 'ael-4',
    kind: 'knowledge',
    title: 'AI 建议任务',
    date: day,
    time: '18:30',
    minutes: 15,
    order: 0,
    source: 'ai',
    review: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const result: ScheduleSuggestionResult = {
  tasks: [suggestion()],
  weekSummary: '本周从一次小实验开始。',
  reasons: { 'ai-suggested': '先认识实验目标，再动手探索。' },
}

function renderPanel({
  requestSuggestion = vi.fn(async () => result),
  initialAvailability = state.learningPlan.availability,
  currentTasks = state.learningPlan.tasks,
  onConfirm = vi.fn(),
  onSaveAvailability = vi.fn(),
}: {
  requestSuggestion?: (request: ScheduleSuggestionRequest, signal?: AbortSignal) => Promise<ScheduleSuggestionResult>
  initialAvailability?: DailyAvailability[]
  currentTasks?: LearningPlanTask[]
  onConfirm?: (tasks: LearningPlanTask[], source: 'ai' | 'fallback') => void
  onSaveAvailability?: (days: DailyAvailability[]) => void
} = {}) {
  return {
    onConfirm,
    onSaveAvailability,
    requestSuggestion,
    ...render(
      <AiSchedulePanel
        grade={state.grade}
        course={course}
        progress={progress}
        availability={initialAvailability}
        currentTasks={currentTasks}
        onSaveAvailability={onSaveAvailability}
        onConfirm={onConfirm}
        onClose={() => undefined}
        requestSuggestion={requestSuggestion}
      />,
    ),
  }
}

describe('AiSchedulePanel', () => {
  it('previews suggestions without writing and confirms only after explicit approval', async () => {
    const user = userEvent.setup()
    const { onConfirm, onSaveAvailability } = renderPanel()

    expect(screen.getByLabelText('正式计划')).toHaveTextContent('第一次 AI 实验')
    expect(screen.getByLabelText('正式计划')).not.toHaveTextContent('AI 建议任务')

    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))
    expect(await screen.findByText('安排预览')).toBeInTheDocument()
    expect(screen.getByText('AI 建议任务')).toBeInTheDocument()
    expect(onSaveAvailability).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByLabelText('正式计划')).not.toHaveTextContent('AI 建议任务')

    const confirm = screen.getByRole('button', { name: '确认采用' })
    await user.click(confirm)
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ title: 'AI 建议任务' })], 'ai')
  })

  it('lets students edit, reorder and delete items in the temporary preview', async () => {
    const second = suggestion({ id: 'ai-second', partId: 'ael-5', title: '第二项建议', time: '19:00' })
    const requestSuggestion = vi.fn(async () => ({
      ...result,
      tasks: [suggestion(), second],
      reasons: { 'ai-suggested': '先探索。', 'ai-second': '再练习。' },
    }))
    const user = userEvent.setup()
    const { onConfirm } = renderPanel({ requestSuggestion })

    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))
    const preview = await screen.findByRole('list', { name: '建议安排列表' })
    const first = within(preview).getAllByRole('listitem')[0]
    await user.click(within(first).getByRole('button', { name: '下移 AI 建议任务' }))
    expect(within(preview).getAllByRole('listitem')[0]).toHaveTextContent('第二项建议')

    await user.clear(within(preview).getAllByRole('spinbutton', { name: /预计时长/ })[1])
    await user.type(within(preview).getAllByRole('spinbutton', { name: /预计时长/ })[1], '20')
    await user.click(within(preview).getByRole('button', { name: '删除 第二项建议' }))
    expect(screen.queryByText('第二项建议')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认采用' }))
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'AI 建议任务', minutes: 20 }),
    ], 'ai')
  })

  it('falls back to a local editable plan when the AI endpoint is unavailable', async () => {
    const requestSuggestion = vi.fn(async () => {
      throw new ScheduleSuggestionError(503, 'missing_api_key')
    })
    const user = userEvent.setup()
    const { onConfirm } = renderPanel({ requestSuggestion })

    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))

    expect(await screen.findByText('AI 暂时没连上，先给你一份可以继续修改的基础安排')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成 7 天建议' })).not.toBeDisabled()
    await user.click(screen.getByRole('button', { name: '确认采用' }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ source: 'fallback' })]),
      'fallback',
    )
  })

  it('keeps the saved plan untouched when the fallback cannot fit a task', async () => {
    const noRoom = state.learningPlan.availability.map((day, index) => ({
      ...day,
      enabled: index === 0,
      maxMinutes: 5,
      startTime: '18:30',
      endTime: '18:35',
    }))
    const requestSuggestion = vi.fn(async () => {
      throw new ScheduleSuggestionError(502, 'provider_error')
    })
    const user = userEvent.setup()
    const { onConfirm } = renderPanel({ requestSuggestion, initialAvailability: noRoom })

    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('暂时没有合适的基础安排'))
    expect(screen.queryByText('安排预览')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables generation when no day is enabled and aborts a request on unmount', async () => {
    const user = userEvent.setup()
    const disabledDays = state.learningPlan.availability.map((day) => ({ ...day, enabled: false }))
    const requestSuggestion = vi.fn((_request: ScheduleSuggestionRequest, signal?: AbortSignal) =>
      new Promise<ScheduleSuggestionResult>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }))
    const { onSaveAvailability, unmount } = renderPanel({
      requestSuggestion,
      initialAvailability: disabledDays,
      onSaveAvailability: vi.fn(),
    })
    expect(screen.getByRole('button', { name: '生成 7 天建议' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /今天/ }))
    expect(screen.getByRole('button', { name: '生成 7 天建议' })).not.toBeDisabled()
    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))
    const signal = requestSuggestion.mock.calls[0][1]
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
    expect(onSaveAvailability).toHaveBeenCalled()
  })
})
