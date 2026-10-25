import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider, useAppState } from './AppState'
import { createDefaultState } from './model'
import type { DailyAvailability, LearningPlanTask } from './learningPlan'
import { loadAccountState, saveAccountState } from './companionAccountRepository'

function localDate(offset: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeTask(id: string, overrides: Partial<LearningPlanTask> = {}): LearningPlanTask {
  const timestamp = new Date().toISOString()
  return {
    id,
    grade: 'grade5',
    partId: 'ael-4',
    kind: 'knowledge',
    title: `任务 ${id}`,
    date: localDate(0),
    time: '18:30',
    minutes: 15,
    order: 0,
    source: 'student',
    review: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function seedPlan(accountId: string, tasks: LearningPlanTask[]) {
  const state = { ...createDefaultState(), accountId }
  state.learningPlan = { ...state.learningPlan, tasks }
  saveAccountState(accountId, state)
  return state
}

function PlanHarness({
  replacement,
  inserted,
  removeId,
  reorderDate,
  reorderIds,
  availability,
}: {
  replacement: LearningPlanTask[]
  inserted: LearningPlanTask
  removeId: string
  reorderDate: string
  reorderIds: string[]
  availability: DailyAvailability[]
}) {
  const app = useAppState()
  return (
    <>
      <output aria-label="account">{app.state.accountId}</output>
      <output aria-label="plan">{app.state.learningPlan.tasks.map((task) => `${task.id}:${task.partId}:${task.source}:${task.order}`).join('|')}</output>
      <output aria-label="availability">{app.state.learningPlan.availability.map((day) => `${day.date}:${day.enabled}:${day.maxMinutes}`).join('|')}</output>
      <button type="button" onClick={() => app.login('student_a')}>登录账号 A</button>
      <button type="button" onClick={() => app.login('student_b')}>登录账号 B</button>
      <button type="button" onClick={() => app.replaceLearningPlan(replacement, 'ai')}>采用 AI 预览</button>
      <button type="button" onClick={() => app.upsertPlanTask(inserted)}>保存计划任务</button>
      <button type="button" onClick={() => app.removePlanTask(removeId)}>删除计划任务</button>
      <button type="button" onClick={() => app.reorderPlanTasks(reorderDate, reorderIds)}>保存任务顺序</button>
      <button type="button" onClick={() => app.setPlanAvailability(availability)}>保存可用时间</button>
    </>
  )
}

describe('learning plan state actions', () => {
  beforeEach(() => localStorage.clear())

  it('replaces only the active seven-day window and preserves completed history', async () => {
    const history = makeTask('history', { partId: 'ael-1', date: localDate(-8), minutes: 20 })
    const unfinishedHistory = makeTask('unfinished-history', { partId: 'ael-4', date: localDate(-9), minutes: 20 })
    const replacement = makeTask('replacement', { partId: 'ael-5', source: 'fallback' })
    const outsideWindow = makeTask('outside-window', { date: localDate(8) })
    const wrongGradeBand = makeTask('wrong-band', { grade: 'grade3', partId: 'cxd-4' })
    seedPlan('student_a', [history, unfinishedHistory])
    const user = userEvent.setup()

    render(
      <AppStateProvider>
        <PlanHarness
          replacement={[replacement, outsideWindow, wrongGradeBand]}
          inserted={makeTask('unused')}
          removeId="unused"
          reorderDate={localDate(0)}
          reorderIds={[]}
          availability={[]}
        />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '登录账号 A' }))
    await user.click(screen.getByRole('button', { name: '采用 AI 预览' }))

    expect(screen.getByLabelText('plan')).toHaveTextContent('history:ael-1:student:0')
    expect(screen.getByLabelText('plan')).not.toHaveTextContent('unfinished-history')
    expect(screen.getByLabelText('plan')).toHaveTextContent('replacement:ael-5:ai:0')
    expect(screen.getByLabelText('plan')).not.toHaveTextContent('outside-window')
    expect(screen.getByLabelText('plan')).not.toHaveTextContent('wrong-band')
    await waitFor(() => {
      expect(loadAccountState('student_a').learningPlan.tasks.map((task) => task.id)).toEqual(['history', 'replacement'])
    })
  })

  it('preserves the source of existing tasks in a mixed replacement', async () => {
    const retained = makeTask('retained-student-task', {
      time: '18:30',
      source: 'student',
    })
    const added = makeTask('new-ai-task', {
      partId: 'ael-5',
      time: '19:00',
      source: 'ai',
    })
    seedPlan('student_a', [retained])
    const user = userEvent.setup()

    render(
      <AppStateProvider>
        <PlanHarness
          replacement={[retained, added]}
          inserted={makeTask('unused')}
          removeId="unused"
          reorderDate={localDate(0)}
          reorderIds={[]}
          availability={[]}
        />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '登录账号 A' }))
    await user.click(screen.getByRole('button', { name: '采用 AI 预览' }))

    expect(screen.getByLabelText('plan')).toHaveTextContent('retained-student-task:ael-4:student:0')
    expect(screen.getByLabelText('plan')).toHaveTextContent('new-ai-task:ael-5:ai:0')
  })

  it('upserts, removes and reorders tasks while saving valid availability', async () => {
    const first = makeTask('first', { order: 0 })
    const second = makeTask('second', { order: 1, time: '19:00' })
    const third = makeTask('third', { order: 2, time: '19:30' })
    const inserted = makeTask('inserted', { title: '新加入的计划', time: '20:00' })
    const availability = createDefaultState().learningPlan.availability.map((day, index) => ({
      ...day,
      enabled: index !== 0,
      maxMinutes: index === 0 ? 45 : day.maxMinutes,
    }))
    seedPlan('student_a', [first, second, third])
    const user = userEvent.setup()

    render(
      <AppStateProvider>
        <PlanHarness
          replacement={[]}
          inserted={inserted}
          removeId="first"
          reorderDate={localDate(0)}
          reorderIds={['third', 'inserted', 'second']}
          availability={availability}
        />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '登录账号 A' }))
    await user.click(screen.getByRole('button', { name: '保存计划任务' }))
    expect(screen.getByLabelText('plan')).toHaveTextContent('inserted:ael-4:student:0')

    await user.click(screen.getByRole('button', { name: '删除计划任务' }))
    expect(screen.getByLabelText('plan')).not.toHaveTextContent('first:')

    await user.click(screen.getByRole('button', { name: '保存任务顺序' }))
    expect(screen.getByLabelText('plan')).toHaveTextContent('third:ael-4:student:0')
    expect(screen.getByLabelText('plan')).toHaveTextContent('inserted:ael-4:student:1')
    expect(screen.getByLabelText('plan')).toHaveTextContent('second:ael-4:student:2')

    await user.click(screen.getByRole('button', { name: '保存可用时间' }))
    expect(screen.getByLabelText('availability')).toHaveTextContent(`${localDate(0)}:false:45`)

    await waitFor(() => {
      const saved = loadAccountState('student_a').learningPlan
      expect(saved.tasks.map((task) => [task.id, task.order])).toEqual([
        ['third', 0], ['inserted', 1], ['second', 2],
      ])
      expect(saved.availability[0]).toMatchObject({ date: localDate(0), enabled: false, maxMinutes: 45 })
    })
  })

  it('keeps persisted plan edits isolated by learning account', async () => {
    seedPlan('student_a', [makeTask('account-a-task')])
    seedPlan('student_b', [makeTask('account-b-task')])
    const user = userEvent.setup()

    render(
      <AppStateProvider>
        <PlanHarness
          replacement={[makeTask('account-a-ai')]}
          inserted={makeTask('account-b-edit')}
          removeId="missing"
          reorderDate={localDate(0)}
          reorderIds={[]}
          availability={createDefaultState().learningPlan.availability}
        />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '登录账号 A' }))
    await user.click(screen.getByRole('button', { name: '采用 AI 预览' }))
    await waitFor(() => {
      expect(loadAccountState('student_a').learningPlan.tasks.map((task) => task.id)).toEqual(['account-a-ai'])
    })

    await user.click(screen.getByRole('button', { name: '登录账号 B' }))
    expect(screen.getByLabelText('account')).toHaveTextContent('student_b')
    expect(screen.getByLabelText('plan')).toHaveTextContent('account-b-task')
    expect(screen.getByLabelText('plan')).not.toHaveTextContent('account-a-ai')

    await user.click(screen.getByRole('button', { name: '保存计划任务' }))
    await waitFor(() => {
      expect(loadAccountState('student_a').learningPlan.tasks.map((task) => task.id)).toEqual(['account-a-ai'])
      expect(loadAccountState('student_b').learningPlan.tasks.map((task) => task.id)).toEqual(['account-b-task', 'account-b-edit'])
    })
  })
})
