import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { saveAccountState } from '../../app/companionAccountRepository'
import type { LearningPlanTask } from '../../app/learningPlan'
import { createDefaultState } from '../../app/model'
import { SessionCredentialProvider, useSessionCredential } from '../auth/sessionCredential'
import { AppCommandProvider, useAppCommand } from '../ai_companion/commands/AppCommandContext'
import type { InterpretedIntent } from '../ai_companion/commands/commandTypes'
import { MainShell } from './MainShell'

function localDate(offset: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function seedPlan(task: Partial<LearningPlanTask> = {}) {
  const timestamp = new Date().toISOString()
  const state = createDefaultState()
  state.learningPlan.tasks = [{
    id: 'shell-plan-task',
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
    ...task,
  }]
  saveAccountState(state.accountId, state)
}

function CredentialSeed() {
  const credential = useSessionCredential()
  useEffect(() => credential.establish('chenxi_2026', 'demo-password'), [credential])
  return null
}

function CommandTrigger() {
  const command = useAppCommand()
  return <button type="button" onClick={() => void command.submitText('执行伙伴指令', 'voice')}>执行伙伴指令</button>
}

function renderWithCompanionCommand(intent: InterpretedIntent) {
  return render(
    <SessionCredentialProvider>
      <CredentialSeed />
      <AppStateProvider>
        <AppCommandProvider interpret={async () => intent}>
          <CommandTrigger />
          <MainShell />
        </AppCommandProvider>
      </AppStateProvider>
    </SessionCredentialProvider>,
  )
}

describe('main shell navigation', () => {
  beforeEach(() => localStorage.clear())

  it('keeps four main destinations available', () => {
    render(<AppStateProvider><MainShell /></AppStateProvider>)
    const nav = screen.getByRole('navigation', { name: '主要导航' })
    expect(nav).toBeInTheDocument()
    for (const label of ['首页', '知识', '测试', '我的']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('opens the available knowledge course and test map', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '知识' }))
    expect(screen.getByRole('heading', { name: 'AI 探索实验室' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '测试' }))
    expect(screen.getByRole('region', { name: '闯关地图' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeInTheDocument()
  })

  it('opens the test tab from a grade 5-6 lesson without passing its challenge', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '知识' }))
    const chapter = screen.getByRole('button', { name: /第4章.*第一次 AI 实验/ })
    if (chapter.getAttribute('aria-expanded') === 'false') await user.click(chapter)
    await user.click(screen.getByRole('button', { name: '阅读本章内容' }))
    await user.click(screen.getByRole('button', { name: '去第 4 章测试' }))

    expect(screen.getByRole('region', { name: '闯关地图' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '测试' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: '第4章 · 第一次 AI 实验' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('闯关进度')).toHaveTextContent('2/ 9')
  })

  it('keeps the AI companion available on nested app screens', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '进入设置' }))

    expect(screen.getByRole('button', { name: 'AI伙伴' })).toBeInTheDocument()
  })

  it('gives the floating companion the active learning scene for its short reaction', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '知识' }))
    await user.click(screen.getByRole('button', { name: 'AI伙伴' }))

    expect(screen.getByRole('status')).toHaveTextContent('知识')
  })

  it('opens a creative game inside the app without bottom navigation', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /脑洞放映厅/ }))

    expect(screen.getByTitle('脑洞放映厅')).toHaveAttribute('src', 'http://127.0.0.1:5191/?gameVersion=20261021-3')
    expect(screen.queryByRole('navigation', { name: '主要导航' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'AI伙伴' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(screen.getByRole('heading', { name: /你好/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeInTheDocument()
  })

  it('opens the most recently played game directly from the empty works card', async () => {
    const user = userEvent.setup()
    localStorage.setItem('zhiya:last-played-game', 'creative-module')
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: /第一件作品正在等你/ }))

    expect(screen.getByTitle('创造模块')).toHaveAttribute('src', 'http://127.0.0.1:5192/?gameVersion=20261021-3')
    expect(screen.queryByRole('heading', { name: '继续创作' })).not.toBeInTheDocument()
  })

  it('opens the default game when no recent game has been recorded', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: /第一件作品正在等你/ }))

    expect(screen.getByTitle('脑洞放映厅')).toHaveAttribute('src', 'http://127.0.0.1:5191/?gameVersion=20261021-3')
  })

  it('opens the exact knowledge chapter from the next plan card', async () => {
    const user = userEvent.setup()
    seedPlan()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '开始学习' }))

    expect(screen.getByRole('heading', { name: '第4章 · 第一次 AI 实验' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '知识' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the schedule on the date selected in the month calendar', async () => {
    const user = userEvent.setup()
    seedPlan()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '打开整月日历' }))

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await user.click(screen.getByRole('button', { name: `${tomorrow.getDate()} 日，有安排` }))
    await user.click(screen.getByRole('button', { name: '调整这天的安排' }))

    expect(screen.getByRole('button', { name: /明天 \d{4}-\d{2}-\d{2}，1 项安排/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not open the schedule editor for a date outside the active seven days', async () => {
    const user = userEvent.setup()
    seedPlan()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '打开整月日历' }))
    await user.click(screen.getByRole('button', { name: '上个月' }))
    await user.click(screen.getByRole('button', { name: '15 日' }))

    expect(screen.getByText('此日期仅查看记录，未来七天内的安排可调整。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '调整这天的安排' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '成长安排' })).not.toBeInTheDocument()
  })

  it('opens the exact unlocked test introduction from the next plan card', async () => {
    const user = userEvent.setup()
    seedPlan({
      partId: 'ael-3',
      kind: 'test',
      title: '算法工具箱',
    })
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '开始测试' }))

    expect(screen.getByRole('dialog', { name: '算法工具箱挑战介绍' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '测试' })).toHaveAttribute('aria-current', 'page')
  })

  it('routes a planned locked test to its exact knowledge chapter', async () => {
    const user = userEvent.setup()
    seedPlan({
      partId: 'ael-4',
      kind: 'test',
      title: '第一次 AI 实验',
    })
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '开始学习' }))

    expect(screen.getByRole('heading', { name: '第4章 · 第一次 AI 实验' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '第一次 AI 实验挑战介绍' })).not.toBeInTheDocument()
  })

  it('uses only the in-map interactive companion on the elementary test tab', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '测试' }))
    const companions = screen.getAllByRole('button', { name: 'AI伙伴' })
    expect(companions).toHaveLength(1)
    expect(companions[0]).toHaveAttribute('data-companion-placement', 'test-map')
  })

  it('reviews a failed challenge in the matching Knowledge chapter', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '测试' }))
    await user.click(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    for (const answer of ['聚类', '分类', '分类', '对', '直接替所有人决定']) {
      await user.click(screen.getByRole('button', { name: answer }))
      await user.click(screen.getByRole('button', { name: /下一题|查看成绩/ }))
    }

    await user.click(screen.getByRole('button', { name: '回顾第 3 部分知识' }))

    expect(screen.getByRole('heading', { name: '第3章 · 算法工具箱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '知识' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '测试' })).not.toHaveAttribute('aria-current')
  })

  it('opens the knowledge tab from a natural-language navigation command', async () => {
    const user = userEvent.setup()
    renderWithCompanionCommand({
      kind: 'command',
      reply: '我们去知识页。',
      command: { type: 'navigate', target: 'knowledge' },
    })

    await user.click(screen.getByRole('button', { name: '执行伙伴指令' }))

    expect(screen.getByRole('heading', { name: 'AI 探索实验室' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '知识' })).toHaveAttribute('aria-current', 'page')
  })

  it('returns to the current learning position without losing command access', async () => {
    const user = userEvent.setup()
    renderWithCompanionCommand({
      kind: 'command',
      reply: '回到上次学习的地方。',
      command: { type: 'continue-learning' },
    })

    await user.click(screen.getByRole('button', { name: '执行伙伴指令' }))

    expect(screen.getByRole('heading', { name: '第3章 · 算法工具箱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI伙伴' })).toBeInTheDocument()
  })

  it('opens the last played game when asked to continue a game', async () => {
    const user = userEvent.setup()
    renderWithCompanionCommand({
      kind: 'command',
      reply: '继续上次的创意游戏。',
      command: { type: 'resume-game' },
    })

    await user.click(screen.getByRole('button', { name: '执行伙伴指令' }))

    expect(screen.getByRole('heading', { name: '脑洞放映厅' })).toBeInTheDocument()
    expect(screen.getByTitle('脑洞放映厅')).toBeInTheDocument()
  })

  it('opens account security only after the high-risk password succeeds', async () => {
    const user = userEvent.setup()
    renderWithCompanionCommand({
      kind: 'command',
      reply: '修改账号安全设置需要先验证密码。',
      command: { type: 'update-account-security' },
    })

    await user.click(screen.getByRole('button', { name: '执行伙伴指令' }))
    expect(screen.getByRole('dialog', { name: '修改账号安全设置' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '账号与安全' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('当前账号密码'), 'demo-password')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))

    expect(screen.getByRole('heading', { name: '账号与安全' })).toBeInTheDocument()
  })
})
