import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WORK_SAVE_DRAFT, type GameSource } from '@zhiya/works-bridge'
import { AppStateProvider } from './AppState'
import { loadAccountState } from './companionAccountRepository'
import { MainShell } from '../features/shell/MainShell'
import { createMemoryWorkRepository } from '../features/works/memoryRepository'
import type { WorkRepository } from '../features/works/types'
import { WorksProvider } from '../features/works/WorksProvider'

function IntegratedTestApp({ repository }: { repository: WorkRepository }) {
  return (
    <AppStateProvider>
      <WorksProvider accountId="chenxi_2026" repository={repository}>
        <MainShell />
      </WorksProvider>
    </AppStateProvider>
  )
}

function dispatchGameDraft(source: GameSource, title: string) {
  const frame = screen.getByTitle(source === 'brain-film' ? '脑洞放映厅' : '创造模块') as HTMLIFrameElement
  fireEvent(window, new MessageEvent('message', {
    origin: source === 'brain-film' ? 'http://127.0.0.1:5191' : 'http://127.0.0.1:5192',
    source: frame.contentWindow,
    data: {
      type: WORK_SAVE_DRAFT,
      version: 1,
      source,
      draftId: 'demo-1',
      title,
      description: '我做的一部小电影',
      fileName: 'film.bhfilm',
      blob: new Blob(['film'], { type: 'application/json' }),
    },
  }))
}

describe('game and works integration', () => {
  it('游戏导出草稿、发布并在首页互动', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    render(<IntegratedTestApp repository={repository} />)

    await user.click(screen.getByRole('button', { name: /脑洞放映厅/ }))
    dispatchGameDraft('brain-film', '云朵电影院')
    expect(await screen.findByText('已保存到智芽·我的作品')).toBeInTheDocument()
    await waitFor(() => {
      expect(loadAccountState('chenxi_2026').learningEvents).toEqual([
        expect.objectContaining({
          action: 'work-completed',
          source: 'creative',
        }),
      ])
    })
    await user.click(screen.getByRole('button', { name: '返回首页' }))

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '作品管理' }))
    expect(await screen.findByText('云朵电影院')).toBeInTheDocument()
    const card = screen.getByText('云朵电影院').closest('.wm-card') as HTMLElement
    await user.click(card.querySelector('button.wm-action-ghost') as HTMLButtonElement)

    await waitFor(async () => {
      const works = await repository.list('chenxi_2026')
      expect(works[0]).toMatchObject({ title: '云朵电影院', status: 'published' })
    })

    await user.click(screen.getByRole('button', { name: '首页' }))
    expect(await screen.findByText('云朵电影院')).toBeInTheDocument()
    const homeCard = screen.getByText('云朵电影院').closest('.showcase-card') as HTMLElement
    const like = within(homeCard).getByRole('button', { name: '点赞作品' })
    await user.click(like)
    expect(like).toHaveAttribute('aria-pressed', 'true')
    expect((await repository.list('chenxi_2026'))[0].likedBy).toEqual(['chenxi_2026'])
  })
})
