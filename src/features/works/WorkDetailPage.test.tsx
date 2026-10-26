import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { createMemoryWorkRepository } from './memoryRepository'
import { WorkDetailPage } from './WorkDetailPage'
import { WorksProvider } from './WorksProvider'

async function createPublishedWork() {
  const repository = createMemoryWorkRepository()
  const work = await repository.saveDraft('123', {
    source: 'external-upload',
    title: '会发光的纸飞机',
    description: '我让纸飞机带上了一盏小灯。',
    aiTools: ['豆包'],
    fileName: 'plane.txt',
    blob: new Blob(['纸飞机的故事'], { type: 'text/plain' }),
  })
  await repository.setStatus('123', work.id, 'published')
  return { repository, workId: work.id }
}

describe('WorkDetailPage', () => {
  it('点赞收藏和友好留言写入同一条作品记录', async () => {
    const user = userEvent.setup()
    const { repository, workId } = await createPublishedWork()
    render(
      <AppStateProvider>
        <WorksProvider accountId="123" repository={repository}>
          <WorkDetailPage workId={workId} onBack={vi.fn()} />
        </WorksProvider>
      </AppStateProvider>,
    )

    expect(await screen.findByRole('heading', { name: '会发光的纸飞机' })).toBeInTheDocument()
    const like = screen.getByRole('button', { name: '点赞作品' })
    await user.click(like)
    await waitFor(async () => {
      expect((await repository.get('123', workId))?.likedBy)
        .toContain('123')
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '点赞作品' }))
        .toHaveAttribute('aria-pressed', 'true')
    })
    const favorite = screen.getByRole('button', { name: '收藏作品' })
    await user.click(favorite)
    expect(favorite).toHaveAttribute('aria-pressed', 'true')

    await user.type(screen.getByRole('textbox', { name: '写留言' }), '这个想法真有趣！')
    await user.click(screen.getByRole('button', { name: '提交留言' }))
    expect(await screen.findByText('这个想法真有趣！')).toBeInTheDocument()
    expect((await repository.get('123', workId))?.comments).toHaveLength(1)
  })

  it('不礼貌留言不写入仓库', async () => {
    const user = userEvent.setup()
    const { repository, workId } = await createPublishedWork()
    render(
      <AppStateProvider>
        <WorksProvider accountId="123" repository={repository}>
          <WorkDetailPage workId={workId} onBack={vi.fn()} />
        </WorksProvider>
      </AppStateProvider>,
    )

    await screen.findByRole('heading', { name: '会发光的纸飞机' })
    await user.type(screen.getByRole('textbox', { name: '写留言' }), '你真笨')
    await user.click(screen.getByRole('button', { name: '提交留言' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('换一种友好的说法')
    expect((await repository.get('123', workId))?.comments).toHaveLength(0)
  })
})
