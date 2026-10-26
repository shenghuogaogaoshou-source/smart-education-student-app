import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { saveAccountState } from '../../app/companionAccountRepository'
import { createLearningEvent } from '../../app/learningEvents'
import type { LearningPlanTask } from '../../app/learningPlan'
import { createDefaultState } from '../../app/model'
import { CalendarPage } from './CalendarPage'
import { ProfilePage } from './ProfilePage'
import { ProfileDetailPage } from './ProfileDetailPage'
import { ProfileEditPage } from './ProfileEditPage'

function localDate(offset: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function planTask(overrides: Partial<LearningPlanTask> = {}): LearningPlanTask {
  const timestamp = new Date().toISOString()
  return {
    id: 'profile-real-task',
    grade: 'grade5',
    partId: 'ael-4',
    kind: 'knowledge',
    title: '第一次 AI 实验',
    date: localDate(1),
    time: '19:00',
    minutes: 15,
    order: 0,
    source: 'student',
    review: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function seedPlan(tasks: LearningPlanTask[]) {
  const state = createDefaultState()
  state.learningPlan.tasks = tasks
  saveAccountState(state.accountId, state)
  return state
}

function withoutDemoProgress(state: ReturnType<typeof createDefaultState>) {
  state.learningProgress = {
    'grade1-2': { knowledgeCompleted: [], testsPassed: [] },
    'grade3-4': { knowledgeCompleted: [], testsPassed: [] },
    'grade5-6': { knowledgeCompleted: [], testsPassed: [] },
  }
  return state
}

describe('profile dashboard', () => {
  beforeEach(() => localStorage.clear())

  it('presents the current primary grade and band without stage labels', () => {
    const view = render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('五年级 · 5—6 年级')).toBeInTheDocument()
    expect(screen.queryByText('小学端')).not.toBeInTheDocument()

    view.unmount()
    render(<AppStateProvider><ProfileDetailPage onBack={vi.fn()} onEdit={vi.fn()} /></AppStateProvider>)
    expect(screen.getByText('年级')).toBeInTheDocument()
    expect(screen.getByText('五年级 · 5—6 年级')).toBeInTheDocument()
    expect(screen.queryByText('学段')).not.toBeInTheDocument()
  })

  it('edits only primary grades without a stage selector', () => {
    render(<AppStateProvider><ProfileEditPage onBack={vi.fn()} onDone={vi.fn()} /></AppStateProvider>)

    expect(screen.queryByRole('radiogroup', { name: '选择学段' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(screen.getByRole('radio', { name: '一年级' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '六年级' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: '初一' })).not.toBeInTheDocument()
  })

  it('contains every approved profile module in the agreed order', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: '晨曦同学' })).toBeInTheDocument()
    expect(screen.getByText('本周学习')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '成长安排' })).toBeInTheDocument()
    expect(screen.getByText('我的勋章')).toBeInTheDocument()
    expect(screen.getByText('积分账户')).toBeInTheDocument()
    expect(screen.getByText('积分商城')).toBeInTheDocument()
    expect(screen.getByText('错题本')).toBeInTheDocument()
    expect(screen.getByText('AI 伙伴中心')).toBeInTheDocument()
    expect(screen.getByText('我的作品')).toBeInTheDocument()
    for (const status of ['草稿', '审核中', '已发布', '仅自己']) {
      expect(screen.getByText(status)).toBeInTheDocument()
    }
    expect(screen.getByText('第一件作品正在等你')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入设置' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '成长画像' }))
    expect(screen.getByRole('heading', { name: '近期成长足迹' })).toBeInTheDocument()
    await screen.findByLabelText('近期成长足迹五维雷达图', {}, { timeout: 10_000 })
    for (const dimension of ['好奇探索', '知识理解', '问题解决', '实践创造', '自主规划']) {
      expect(screen.getByText(dimension)).toBeInTheDocument()
    }
    expect(screen.getByText('正在认识你的学习方式')).toBeInTheDocument()
  })

  it('renders live profile scores and the persisted gentle title', async () => {
    const user = userEvent.setup()
    const state = withoutDemoProgress(createDefaultState())
    state.learningEvents = [createLearningEvent({
      accountId: state.accountId,
      gradeBand: 'grade5-6',
      source: 'knowledge',
      contentId: 'ael-4',
      action: 'knowledge-completed',
      occurredAt: '2026-10-26T09:00:00.000Z',
    })]
    state.growthTitle = {
      text: '愿意多问一步的小探索家',
      description: '你认真看完了一段新知识，还留下了继续探索的线索。',
      eventId: state.learningEvents[0].id,
    }
    saveAccountState(state.accountId, state)
    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '成长画像' }))

    expect(screen.getByText('愿意多问一步的小探索家')).toBeInTheDocument()
    expect(screen.getByText('好奇探索 42 · 知识理解 44 · 问题解决 40 · 实践创造 40 · 自主规划 40'))
      .toBeInTheDocument()
  })

  it('shows the real next plan task and opens the schedule flow for AI advice', async () => {
    const user = userEvent.setup()
    const task = planTask({ review: true })
    seedPlan([task])
    const onStartTask = vi.fn()
    const onOpenSchedule = vi.fn()
    render(
      <AppStateProvider>
        <ProfilePage
          onOpenSettings={vi.fn()}
          onOpenProfileDetail={vi.fn()}
          onStartTask={onStartTask}
          onOpenSchedule={onOpenSchedule}
        />
      </AppStateProvider>,
    )

    expect(screen.getByRole('heading', { name: '第一次 AI 实验' })).toBeInTheDocument()
    expect(screen.queryByText('图片识别小探索')).not.toBeInTheDocument()
    expect(screen.getByText('知识')).toBeInTheDocument()
    expect(screen.getByText('复习')).toBeInTheDocument()
    expect(screen.getByText('预计 15 分钟')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始学习' }))
    expect(onStartTask).toHaveBeenCalledWith(task)

    await user.click(screen.getByRole('button', { name: 'AI 帮我安排' }))
    expect(onOpenSchedule).toHaveBeenCalledOnce()
  })

  it('counts following tasks by date, time and order instead of date alone', () => {
    const earlierSameDay = planTask({
      id: 'profile-earlier-overdue',
      partId: 'ael-4',
      title: '第一次 AI 实验',
      date: localDate(-1),
      time: '09:00',
      order: 0,
    })
    const laterSameDay = planTask({
      id: 'profile-later-overdue',
      partId: 'ael-5',
      title: '给 AI 当评委',
      date: localDate(-1),
      time: '18:00',
      order: 1,
    })
    seedPlan([earlierSameDay, laterSameDay])

    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: '给 AI 当评委' })).toBeInTheDocument()
    expect(screen.getByText('这是最近的一项')).toBeInTheDocument()
    expect(screen.queryByText('之后还有 1 项')).not.toBeInTheDocument()
  })

  it('shows an overdue pending task as waiting for adjustment without changing its date', async () => {
    const task = planTask({ date: localDate(-1), time: '18:30' })
    seedPlan([task])
    const onStartTask = vi.fn()
    render(
      <AppStateProvider>
        <ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} onStartTask={onStartTask} />
      </AppStateProvider>,
    )

    expect(screen.getByRole('heading', { name: '第一次 AI 实验' })).toBeInTheDocument()
    expect(screen.getByText('待调整')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: '开始学习' }))
    expect(onStartTask).toHaveBeenCalledWith(expect.objectContaining({ date: task.date }))
  })

  it('renders the account plan and live completion state in the real month calendar', async () => {
    const user = userEvent.setup()
    const task = planTask()
    const completedReview = planTask({
      id: 'profile-completed-review',
      partId: 'ael-1',
      title: 'AI 系统拆解站',
      date: localDate(2),
      review: true,
    })
    seedPlan([task, completedReview])
    const onStartTask = vi.fn()
    const onOpenSchedule = vi.fn()
    render(
      <AppStateProvider>
        <CalendarPage
          onBack={vi.fn()}
          onStartTask={onStartTask}
          onOpenSchedule={onOpenSchedule}
        />
      </AppStateProvider>,
    )

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 1)
    const scheduledDay = screen.getByRole('button', { name: `${targetDate.getDate()} 日，有安排` })
    await user.click(scheduledDay)

    expect(screen.getByText('第一次 AI 实验')).toBeInTheDocument()
    expect(screen.queryByText('语音地图小任务')).not.toBeInTheDocument()
    expect(screen.getByText('待开始')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始 第一次 AI 实验' }))
    expect(onStartTask).toHaveBeenCalledWith(task)
    await user.click(screen.getByRole('button', { name: '调整这天的安排' }))
    expect(onOpenSchedule).toHaveBeenCalledWith(task.date)

    const completedDate = new Date()
    completedDate.setDate(completedDate.getDate() + 2)
    await user.click(screen.getByRole('button', { name: `${completedDate.getDate()} 日，有安排，有已完成` }))
    const completedCard = screen.getByText('AI 系统拆解站').closest('li')
    expect(completedCard).not.toBeNull()
    expect(within(completedCard!).getByText('已完成')).toBeInTheDocument()
    expect(within(completedCard!).getByText('复习')).toBeInTheDocument()
  })

  it('keeps dates outside the editable seven-day window view-only', async () => {
    const user = userEvent.setup()
    seedPlan([])
    const onOpenSchedule = vi.fn()
    render(
      <AppStateProvider>
        <CalendarPage
          onBack={vi.fn()}
          onOpenSchedule={onOpenSchedule}
        />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '上个月' }))
    await user.click(screen.getByRole('button', { name: '15 日' }))

    expect(screen.getByText('此日期仅查看记录，未来七天内的安排可调整。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '调整这天的安排' })).not.toBeInTheDocument()
    expect(onOpenSchedule).not.toHaveBeenCalled()
  })

  it('derives the profile medal count from real learning events', () => {
    const state = withoutDemoProgress(createDefaultState())
    state.learningEvents = [
      createLearningEvent({
        accountId: state.accountId, gradeBand: 'grade5-6', source: 'knowledge',
        contentId: 'ael-1', action: 'knowledge-completed', occurredAt: '2026-10-20T09:00:00.000Z',
      }),
      createLearningEvent({
        accountId: state.accountId, gradeBand: 'grade5-6', source: 'test',
        contentId: 'ael-1', action: 'test-passed', occurredAt: '2026-10-21T09:00:00.000Z',
      }),
    ]
    saveAccountState(state.accountId, state)

    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('我的勋章').closest('button')).toHaveTextContent('2 / 49 枚')
  })

  it('updates the profile-detail medal count when all course events earn the finale', () => {
    const state = createDefaultState()
    const allPartIds = [
      'ael-1', 'ael-2', 'ael-3', 'ael-4', 'ael-5',
      'ael-6', 'ael-7', 'ael-8', 'ael-9',
    ] as const
    state.learningEvents = allPartIds.flatMap((partId, index) => [
      createLearningEvent({
        accountId: state.accountId, gradeBand: 'grade5-6', source: 'knowledge',
        contentId: partId, action: 'knowledge-completed',
        occurredAt: `2026-10-${String(20 + index).padStart(2, '0')}T09:00:00.000Z`,
      }),
      createLearningEvent({
        accountId: state.accountId, gradeBand: 'grade5-6', source: 'test',
        contentId: partId, action: 'test-passed',
        occurredAt: `2026-10-${String(20 + index).padStart(2, '0')}T10:00:00.000Z`,
      }),
    ])
    saveAccountState(state.accountId, state)

    render(<AppStateProvider><ProfileDetailPage onBack={vi.fn()} onEdit={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('获得勋章').parentElement).toHaveTextContent('19 枚')
  })
})
