import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState } from '../../app/companionAccountRepository'
import { defaultState } from '../../app/model'
import { saveState } from '../../app/storage'
import { SettingsPage } from './SettingsPage'

describe('settings page', () => {
  beforeEach(() => localStorage.clear())

  it('organizes settings into five informative groups', () => {
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    for (const group of ['账号与年级', 'AI 伙伴', '学习与使用体验', '隐私与内容安全', '通用与支持']) {
      expect(screen.getByRole('heading', { name: group })).toBeInTheDocument()
    }
    expect(screen.getAllByText('五年级 · 5—6 年级')).not.toHaveLength(0)
    expect(screen.queryByText('账号与学段')).not.toBeInTheDocument()
    expect(screen.queryByText('学段与年级')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出当前账号' })).toBeInTheDocument()
  })

  it('changes the primary grade directly without a stage confirmation', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /学习年级/ }))
    expect(screen.queryByRole('button', { name: '小学端' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '二年级' }))
    expect(screen.getByRole('status')).toHaveTextContent('年级已切换为 二年级')
    expect(screen.queryByRole('dialog', { name: '确认更改学段' })).not.toBeInTheDocument()
  })

  it('changes font scale locally and confirms logout on screen', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /字体与显示/ }))
    await user.click(screen.getByRole('button', { name: '大号' }))
    expect(document.documentElement.dataset.fontScale).toBe('large')

    await user.click(screen.getByRole('button', { name: '返回设置' }))
    await user.click(screen.getByRole('button', { name: '退出当前账号' }))
    expect(screen.getByRole('dialog', { name: '确认退出登录' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认退出' }))
    expect(loadAccountState(defaultState.accountId).isLoggedIn).toBe(false)
  })

  it('shows the equipped companion and sends appearance changes to the points mall', async () => {
    const user = userEvent.setup()
    const onOpenMall = vi.fn()
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} onOpenMall={onOpenMall} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /伙伴与互动/ }))

    expect(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
    expect(screen.queryByText('小启')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('给 AI 伙伴起个名字')).not.toBeInTheDocument()
    expect(screen.queryByText('🤖')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '前往积分商城调整伙伴' }))
    expect(onOpenMall).toHaveBeenCalledTimes(1)
  })

  it('uses the equipped companion name instead of the legacy unified AI name', () => {
    saveState({
      ...defaultState,
      companion: {
        ...defaultState.companion,
        owned: {
          ...defaultState.companion.owned,
          appearance: ['momo', 'cloudbloom'],
        },
        equipped: {
          ...defaultState.companion.equipped,
          appearance: 'cloudbloom',
        },
      },
    })

    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('button', { name: /伙伴与互动，云绽 Cloudbloom/ })).toBeInTheDocument()
    expect(screen.queryByText(/小启/)).not.toBeInTheDocument()
  })

  it('saves when the companion should speak text answers', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /语音与应用控制/ }))
    await user.click(screen.getByRole('button', { name: '始终朗读' }))

    expect(loadAccountState(defaultState.accountId).voiceReplyMode).toBe('always')
  })

  it('uses the approved 智芽 identity in about and rules', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /^关于与规则/ }))

    expect(screen.getByRole('img', { name: '智芽品牌标志' })).toHaveAttribute('src', '/brand/zhinya-mark.png')
    expect(screen.getByRole('heading', { name: '智芽' })).toBeInTheDocument()
    expect(screen.getByText('学生端 v1.1.0')).toBeInTheDocument()
    expect(screen.getByText('© 2026 智芽 · 陪孩子安全、好奇地学习 AI')).toBeInTheDocument()
    expect(screen.queryByText('数智学习世界')).not.toBeInTheDocument()
  })
})
