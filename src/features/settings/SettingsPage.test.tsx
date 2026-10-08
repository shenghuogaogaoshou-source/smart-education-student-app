import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { SettingsPage } from './SettingsPage'

describe('settings page', () => {
  it('organizes settings into five informative groups', () => {
    render(<AppStateProvider><SettingsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    for (const group of ['账号与学段', 'AI 伙伴', '学习与使用体验', '隐私与内容安全', '通用与支持']) {
      expect(screen.getByRole('heading', { name: group })).toBeInTheDocument()
    }
    expect(screen.getByText('小学端 · 五年级')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出当前账号' })).toBeInTheDocument()
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
    expect(localStorage.getItem('student-app-state')).toContain('"isLoggedIn":false')
  })
})
