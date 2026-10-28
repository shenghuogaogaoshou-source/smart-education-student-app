import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryWorkRepository } from '../works/memoryRepository'
import { WorksProvider } from '../works/WorksProvider'
import { WorksManagePage } from './WorksManagePage'

const draft = (title: string, draftId: string) => ({
  source: 'brain-film' as const,
  sourceDraftId: draftId,
  title,
  description: '',
  aiTools: ['脑洞放映厅'],
  fileName: `${draftId}.bhfilm`,
  blob: new Blob(['film']),
})

describe('WorksManagePage', () => {
  it('labels imported and supplied AI works as AI creations', async () => {
    const repository = createMemoryWorkRepository()
    await repository.saveDraft('student-a', {
      source: 'external-upload',
      sourceDraftId: 'external-work-1',
      title: '未来图书馆',
      description: '使用其他 AI 工具完成',
      aiTools: ['豆包'],
      fileName: 'library.webp',
      blob: new Blob(['library'], { type: 'image/webp' }),
    })

    render(
      <WorksProvider accountId="student-a" repository={repository}>
        <WorksManagePage onBack={vi.fn()} />
      </WorksProvider>,
    )

    expect(screen.getByRole('button', { name: '返回' })).toHaveClass('mobile-page-header__back')
    expect(document.querySelector('.works-manage-content')).not.toBeNull()
    const card = (await screen.findByText('未来图书馆')).closest('.wm-card') as HTMLElement
    expect(within(card).getByText(/AI 创作/)).toBeInTheDocument()
  })

  it('只显示仓库记录，并让四种状态可操作', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    const draftWork = await repository.saveDraft('student-a', draft('云朵电影院', 'film-1'))
    const reviewing = await repository.saveDraft('student-a', draft('会唱歌的小车', 'film-2'))
    await repository.setStatus('student-a', reviewing.id, 'reviewing')
    const published = await repository.saveDraft('student-a', draft('星星邮局', 'film-3'))
    await repository.setStatus('student-a', published.id, 'published')
    const privateWork = await repository.saveDraft('student-a', draft('我的秘密手稿', 'film-4'))
    await repository.setStatus('student-a', privateWork.id, 'private')

    render(
      <WorksProvider accountId="student-a" repository={repository}>
        <WorksManagePage onBack={vi.fn()} onContinueCreate={vi.fn()} />
      </WorksProvider>,
    )

    expect(await screen.findByText('云朵电影院')).toBeInTheDocument()
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText('会唱歌的小车')).toBeInTheDocument()
    expect(screen.getByText('星星邮局')).toBeInTheDocument()
    expect(screen.getByText('我的秘密手稿')).toBeInTheDocument()

    const draftCard = screen.getByText('云朵电影院').closest('.wm-card') as HTMLElement
    expect(within(draftCard).getByRole('button', { name: '发布' })).toBeInTheDocument()
    await user.click(within(draftCard).getByRole('button', { name: '发布' }))
    await waitFor(() => {
      const updatedDraftCard = screen.getByText('云朵电影院').closest('.wm-card') as HTMLElement
      expect(within(updatedDraftCard).getByText('已发布')).toBeInTheDocument()
    })

    const reviewingCard = screen.getByText('会唱歌的小车').closest('.wm-card') as HTMLElement
    await user.click(within(reviewingCard).getByRole('button', { name: '撤回' }))
    await waitFor(() => {
      const updatedReviewingCard = screen.getByText('会唱歌的小车').closest('.wm-card') as HTMLElement
      expect(within(updatedReviewingCard).getByText('草稿')).toBeInTheDocument()
    })

    const publishedCard = screen.getByText('星星邮局').closest('.wm-card') as HTMLElement
    await user.click(within(publishedCard).getByRole('button', { name: '仅自己' }))
    await waitFor(() => {
      const updatedPublishedCard = screen.getByText('星星邮局').closest('.wm-card') as HTMLElement
      expect(within(updatedPublishedCard).getByText('仅自己')).toBeInTheDocument()
    })

    const deleteButton = within(draftCard).getByRole('button', { name: '删除作品' })
    await user.click(deleteButton)
    const dialog = await screen.findByRole('dialog', { name: '删除《云朵电影院》？' })
    expect(dialog).toHaveTextContent('删除后无法恢复')
    expect(within(draftCard).queryByRole('button', { name: '确认删除' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(screen.queryByText('云朵电影院')).not.toBeInTheDocument())
    expect(draftWork.id).toBeTruthy()
  })

  it('为演示作品显示真实媒体缩略图', async () => {
    const repository = createMemoryWorkRepository()
    await repository.saveDraft('123', {
      ...draft('会呼吸的时钟', 'demo-video-1'),
      fileName: 'clockwork-morning.mp4',
      blob: new Blob(['preview'], { type: 'video/mp4' }),
    })

    render(
      <WorksProvider accountId="123" repository={repository}>
        <WorksManagePage onBack={vi.fn()} />
      </WorksProvider>,
    )

    expect(await screen.findByRole('img', { name: '会呼吸的时钟' })).toHaveAttribute(
      'src',
      '/demo-works/posters/clockwork-morning.jpg',
    )
  })
})
