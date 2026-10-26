import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState, saveAccountState } from '../../app/companionAccountRepository'
import { createDefaultState } from '../../app/model'
import { SessionCredentialProvider } from '../auth/sessionCredential'
import { AppCommandProvider } from './commands/AppCommandContext'
import type { InterpretedIntent } from './commands/commandTypes'
import { AiPanel, shouldSpeakReply } from './AiPanel'

function renderPanel(
  interpret: (text: string) => Promise<InterpretedIntent> = async () => ({
    kind: 'clarify',
    reply: '我还没听明白。',
  }),
  onExecute = vi.fn(),
  onOpenPrivacySettings?: () => void,
) {
  return render(
    <SessionCredentialProvider>
      <AppStateProvider>
        <AppCommandProvider interpret={interpret} onExecute={onExecute}>
          <AiPanel onClose={vi.fn()} onOpenPrivacySettings={onOpenPrivacySettings} />
        </AppCommandProvider>
      </AppStateProvider>
    </SessionCredentialProvider>,
  )
}

describe('AI companion conversation page', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows a rotatable companion above a stable conversation input area', () => {
    renderPanel()

    expect(screen.getByLabelText('当前 AI 伙伴绒桃 Momo 八方向预览')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '输入想问的问题' })).toBeVisible()
    expect(screen.getByRole('button', { name: '按住说话' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '播放回答' })).toBeInTheDocument()
  })

  it('uses the equipped companion full name throughout the conversation page', () => {
    const state = createDefaultState()
    state.companion.owned.appearance = ['momo', 'cloudbloom']
    state.companion.equipped.appearance = 'cloudbloom'
    saveAccountState(state.accountId, state)

    renderPanel()

    expect(screen.getByRole('heading', { name: '云绽 Cloudbloom' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '云绽 Cloudbloom 的对话' })).toBeInTheDocument()
    expect(screen.getByLabelText('当前 AI 伙伴云绽 Cloudbloom 八方向预览')).toBeInTheDocument()
    expect(screen.getByText('你好，我是云绽 Cloudbloom。想一起弄明白什么？')).toBeInTheDocument()
    expect(screen.queryByText('小启')).not.toBeInTheDocument()
  })

  it('keeps an ordinary question and answer in the scrollable message history', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      reply: '因为地球在形成时不断旋转，所以慢慢变成了接近球形。',
    })))
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByRole('textbox', { name: '输入想问的问题' }), '地球为什么是圆的？')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(screen.getByText('地球为什么是圆的？')).toBeInTheDocument()
    expect(await screen.findByText('因为地球在形成时不断旋转，所以慢慢变成了接近球形。')).toBeInTheDocument()
  })

  it('explains when remote knowledge answers are not configured while local commands remain available', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }))
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByRole('textbox', { name: '输入想问的问题' }), '彩虹为什么有颜色？')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('伙伴的知识问答服务还没连接好，先试试“打开知识”或“继续学习”吧。')).toBeInTheDocument()
  })

  it('routes an explicit app operation through the guarded command context', async () => {
    const onExecute = vi.fn()
    const interpret = vi.fn(async (): Promise<InterpretedIntent> => ({
      kind: 'command',
      reply: '我们一起去知识页。',
      command: { type: 'navigate', target: 'knowledge' },
    }))
    const user = userEvent.setup()
    renderPanel(interpret, onExecute)

    await user.type(screen.getByRole('textbox', { name: '输入想问的问题' }), '打开知识')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(interpret).toHaveBeenCalledWith('打开知识', 'text', 'momo')
    expect(onExecute).toHaveBeenCalledWith({ type: 'navigate', target: 'knowledge' })
  })

  it('shows the real command result instead of a fixed success promise', async () => {
    const user = userEvent.setup()
    renderPanel(async () => ({
      kind: 'clarify',
      reply: '你是想查看当前积分，还是想了解积分怎么获得？',
    }))

    await user.type(screen.getByRole('textbox', { name: '输入想问的问题' }), '查看我的积分')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('你是想查看当前积分，还是想了解积分怎么获得？')).toBeInTheDocument()
    expect(screen.queryByText('我会按你的要求处理；重要操作会先在屏幕上请你确认。')).not.toBeInTheDocument()
  })

  it('opens useful local history and companion settings panels', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: '历史对话' }))
    expect(screen.getByRole('dialog', { name: '本机对话记录' })).toHaveClass('ai-local-sheet')
    await user.click(screen.getByRole('button', { name: '关闭本机对话记录' }))

    await user.click(screen.getByRole('button', { name: '伙伴设置' }))
    expect(screen.getByRole('dialog', { name: '伙伴设置' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '切换语音回复' })).toBeInTheDocument()
  })

  it('groups local history by day, shows message counts and confirms clearing', async () => {
    const now = new Date()
    const timestamp = (offset: number) => new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      9,
      30,
    ).toISOString()
    const state = createDefaultState()
    state.historyCount = 3
    state.conversationSummaries = [
      { id: 'today', topic: '今天的学习', summary: '整理了今天的错题。', occurredAt: timestamp(0), messageCount: 4 },
      { id: 'yesterday', topic: '昨天的探索', summary: '发现了新的 AI 方法。', occurredAt: timestamp(-1), messageCount: 2 },
      { id: 'older', topic: '更早的话题', summary: '留下了旧的学习线索。', occurredAt: timestamp(-3), messageCount: 1 },
    ]
    saveAccountState(state.accountId, state)
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: '历史对话' }))
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '昨天' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '更早' })).toBeInTheDocument()
    expect(screen.getByText('4 条消息')).toBeInTheDocument()
    const card = screen.getByRole('button', { name: /今天的学习/ })
    await user.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: '清空记录' }))
    expect(screen.getByText('确认清空本机对话记录？')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认清空' }))

    const saved = loadAccountState(state.accountId)
    expect(saved.historyCount).toBe(0)
    expect(saved.conversationSummaries).toEqual([])
    expect(screen.getByRole('dialog', { name: '本机对话记录' })).toBeInTheDocument()
    expect(screen.getByText('还没有可回看的对话摘要')).toBeInTheDocument()
  })

  it('shows three compact preference switches and opens privacy settings', async () => {
    const onOpenPrivacySettings = vi.fn()
    const user = userEvent.setup()
    renderPanel(undefined, vi.fn(), onOpenPrivacySettings)

    await user.click(screen.getByRole('button', { name: '伙伴设置' }))
    expect(screen.getAllByRole('switch')).toHaveLength(3)
    expect(screen.getByText('设置只属于当前学习账号')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '管理全部隐私设置' }))
    expect(onOpenPrivacySettings).toHaveBeenCalledOnce()
  })

  it('honors the voice reply mode for text and spoken questions', () => {
    expect(shouldSpeakReply('voice-only', 'text', true)).toBe(false)
    expect(shouldSpeakReply('always', 'text', true)).toBe(true)
    expect(shouldSpeakReply('silent', 'voice', true)).toBe(false)
    expect(shouldSpeakReply('voice-only', 'voice', true)).toBe(true)
    expect(shouldSpeakReply('always', 'text', false)).toBe(false)
  })
})
