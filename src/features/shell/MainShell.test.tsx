import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { SessionCredentialProvider, useSessionCredential } from '../auth/sessionCredential'
import { AppCommandProvider, useAppCommand } from '../ai_companion/commands/AppCommandContext'
import type { InterpretedIntent } from '../ai_companion/commands/commandTypes'
import { MainShell } from './MainShell'

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

    expect(screen.getByTitle('脑洞放映厅')).toHaveAttribute('src', 'http://127.0.0.1:5191')
    expect(screen.queryByRole('navigation', { name: '主要导航' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'AI伙伴' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(screen.getByRole('heading', { name: /你好/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeInTheDocument()
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

  it('resumes the existing creation flow when asked to continue a game', async () => {
    const user = userEvent.setup()
    renderWithCompanionCommand({
      kind: 'command',
      reply: '继续上次的创意游戏。',
      command: { type: 'resume-game' },
    })

    await user.click(screen.getByRole('button', { name: '执行伙伴指令' }))

    expect(screen.getByRole('heading', { name: '继续创作' })).toBeInTheDocument()
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
