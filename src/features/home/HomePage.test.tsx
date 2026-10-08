import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { HomePage } from './HomePage'

describe('home page', () => {
  it('presents the approved homepage hierarchy', () => {
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: /你好/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '消息通知' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索知识、游戏或作品' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拍照与扫码' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '最新 AI 通识资讯' })).toBeInTheDocument()
    const games = within(screen.getByRole('region', { name: '创意 AI 游戏' }))
    expect(games.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '继续学习' })).toBeInTheDocument()
  })

  it('opens honest tool states and keeps showcase interactions local', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '拍照与扫码' }))
    expect(screen.getByRole('heading', { name: '拍照与识别工具' })).toBeInTheDocument()
    expect(screen.getByText('页面初版暂未接入相机与识别服务')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '关闭工具面板' }))

    await user.click(screen.getByRole('button', { name: '每周' }))
    expect(screen.getByRole('button', { name: '每周' })).toHaveAttribute('aria-pressed', 'true')

    const like = screen.getAllByRole('button', { name: '点赞作品' })[0]
    await user.click(like)
    expect(like).toHaveAttribute('aria-pressed', 'true')
  })
})
