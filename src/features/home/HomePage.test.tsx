import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { createDefaultState, defaultState } from '../../app/model'
import { saveState } from '../../app/storage'
import { createMemoryWorkRepository } from '../works/memoryRepository'
import { DEFAULT_DEMO_WORK_ACCOUNT } from '../works/demoWorks'
import { WorksProvider } from '../works/WorksProvider'
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
    const repository = createMemoryWorkRepository()
    const accountId = createDefaultState().accountId
    const work = await repository.saveDraft(accountId, {
      source: 'external-upload',
      title: '我的公开作品',
      description: '',
      aiTools: ['豆包'],
      fileName: 'work.txt',
      blob: new Blob(['作品'], { type: 'text/plain' }),
    })
    await repository.setStatus(accountId, work.id, 'published')
    render(
      <AppStateProvider>
        <WorksProvider accountId={accountId} repository={repository}>
          <HomePage />
        </WorksProvider>
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '拍照与扫码' }))
    expect(screen.getByRole('heading', { name: '拍照与识别工具' })).toBeInTheDocument()
    expect(screen.getByText('拍照、上传或输入文字，查看结果与判断依据')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '关闭工具面板' }))

    await user.click(screen.getByRole('button', { name: '每周' }))
    expect(screen.getByRole('button', { name: '每周' })).toHaveAttribute('aria-pressed', 'true')

    const like = (await screen.findAllByRole('button', { name: '点赞作品' }))[0]
    await user.click(like)
    expect(like).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the supplied artwork as real media cards in the public showcase', async () => {
    const repository = createMemoryWorkRepository()
    render(
      <AppStateProvider>
        <WorksProvider
          accountId={DEFAULT_DEMO_WORK_ACCOUNT}
          repository={repository}
          demoAssetLoader={async (path) => new Blob([path], {
            type: path.endsWith('.mp4') ? 'video/mp4' : 'image/webp',
          })}
        >
          <HomePage />
        </WorksProvider>
      </AppStateProvider>,
    )

    expect(await screen.findByRole('img', { name: '会呼吸的时钟' })).toHaveAttribute(
      'src',
      '/demo-works/posters/clockwork-morning.jpg',
    )
    expect(screen.getAllByText('视频').length).toBeGreaterThan(0)
  })

  it('前两个精选入口按确认顺序打开游戏', async () => {
    const user = userEvent.setup()
    const onOpenGame = vi.fn()
    render(<AppStateProvider><HomePage onOpenGame={onOpenGame} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: /脑洞放映厅/ }))
    expect(onOpenGame).toHaveBeenCalledWith('brain-film')

    await user.click(screen.getByRole('button', { name: /创造模块/ }))
    expect(onOpenGame).toHaveBeenCalledWith('creative-module')
  })

  it('shows the next unfinished knowledge title and opens that exact chapter', async () => {
    const user = userEvent.setup()
    const onOpenContent = vi.fn()
    saveState({
      ...defaultState,
      learningProgress: {
        ...defaultState.learningProgress,
        'grade5-6': {
          knowledgeCompleted: ['ael-3', 'ael-1', 'ael-2'],
          testsPassed: ['ael-1'],
        },
      },
    })
    render(<AppStateProvider><HomePage onOpenContent={onOpenContent} /></AppStateProvider>)

    expect(screen.getByText('上次学到')).toBeInTheDocument()
    expect(screen.getByText('第一次 AI 实验')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续学习' }))
    expect(onOpenContent).toHaveBeenCalledWith('ael', 4)
  })

  it('uses the first knowledge chapter before any chapter is completed', () => {
    saveState({
      ...defaultState,
      learningProgress: {
        ...defaultState.learningProgress,
        'grade5-6': { knowledgeCompleted: [], testsPassed: [] },
      },
    })
    render(<AppStateProvider><HomePage /></AppStateProvider>)

    expect(screen.getByText('AI 系统拆解站')).toBeInTheDocument()
  })
})
