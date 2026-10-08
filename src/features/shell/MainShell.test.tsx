import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { MainShell } from './MainShell'

describe('main shell navigation', () => {
  it('keeps four main destinations available', () => {
    render(<AppStateProvider><MainShell /></AppStateProvider>)
    const nav = screen.getByRole('navigation', { name: '主要导航' })
    expect(nav).toBeInTheDocument()
    for (const label of ['首页', '知识', '测试', '我的']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('opens the interactive knowledge plan and challenge map from the bottom navigation', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '知识' }))
    expect(screen.getByRole('heading', { name: '学习计划' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '体验周' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: '测试' }))
    expect(screen.getByRole('heading', { name: 'AI 小博士养成记' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '闯关地图' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeInTheDocument()
  })
})
