import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { homeCopy } from './homeData'
import { HomePage } from './HomePage'

function carousel() {
  return screen.getByRole('region', { name: '最新 AI 通识资讯' })
}

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
    expect(screen.getByText('AI 通识新鲜报')).toBeInTheDocument()
    expect(screen.queryByText('AI 前沿资讯')).not.toBeInTheDocument()
  })

  it('shows the first comic cover behind the news title with its gradient scrim', () => {
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    const banner = carousel().querySelector('.news-carousel') as HTMLElement
    const first = homeCopy.news[0]
    expect(banner.style.getPropertyValue('--news-cover')).toBe(`url('${first.cover}')`)
    expect(screen.getByRole('heading', { name: first.title })).toBeInTheDocument()

    const overlay = banner.querySelector('.news-carousel-overlay') as HTMLElement
    expect(overlay).toHaveAttribute('aria-hidden', 'true')
    expect(overlay.style.background).toContain('linear-gradient')
  })

  it('swaps the cover and title together when another news dot is chosen', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    const third = homeCopy.news[2]
    await user.click(screen.getByRole('button', { name: '第 3 条资讯' }))

    const banner = carousel().querySelector('.news-carousel') as HTMLElement
    expect(banner.style.getPropertyValue('--news-cover')).toBe(`url('${third.cover}')`)
    expect(screen.getByRole('heading', { name: third.title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 3 条资讯' })).toHaveClass('active')
  })

  it('keeps every news item addressable by a dot and illustrated by a local cover', () => {
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    expect(homeCopy.news).toHaveLength(4)
    for (const [index, news] of homeCopy.news.entries()) {
      expect(screen.getByRole('button', { name: `第 ${index + 1} 条资讯` })).toBeInTheDocument()
      expect(news.cover.startsWith('/courses/qmx/bg-')).toBe(true)
      expect(news.title.length).toBeGreaterThan(0)
    }
  })

  it('opens honest tool states and keeps showcase interactions local', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '拍照与扫码' }))
    expect(screen.getByRole('heading', { name: '拍照与识别工具' })).toBeInTheDocument()
    expect(screen.getByText('拍照、上传或输入文字，查看结果与判断依据')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '关闭工具面板' }))

    await user.click(screen.getByRole('button', { name: '每周' }))
    expect(screen.getByRole('button', { name: '每周' })).toHaveAttribute('aria-pressed', 'true')

    const like = screen.getAllByRole('button', { name: '点赞作品' })[0]
    await user.click(like)
    expect(like).toHaveAttribute('aria-pressed', 'true')
  })
})
