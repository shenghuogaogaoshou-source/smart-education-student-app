import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { seedDemoWorks } from './demoWorks'
import { createMemoryWorkRepository } from './memoryRepository'
import { WorksGalleryPage } from './WorksGalleryPage'
import { WorksProvider } from './WorksProvider'

describe('WorksGalleryPage', () => {
  it('uses illustrated back and ranking-period controls', () => {
    render(
      <AppStateProvider>
        <WorksGalleryPage onBack={vi.fn()} />
      </AppStateProvider>,
    )

    const back = screen.getByRole('button', { name: '返回' })
    expect(back).toHaveClass('gallery-back-button')
    expect(back.querySelector('svg')).not.toBeNull()

    for (const label of ['每天', '每周', '每年']) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toHaveClass('gallery-period-button')
      expect(button.querySelector('svg')).not.toBeNull()
    }
  })

  it('只展示真实已发布作品并共享点赞收藏', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    const published = await repository.saveDraft('student-a', {
      source: 'creative-module',
      title: '会分类的小车',
      description: '',
      aiTools: ['创造模块'],
      fileName: 'car.json',
      blob: new Blob(['{}']),
    })
    await repository.setStatus('student-a', published.id, 'published')
    const draft = await repository.saveDraft('student-a', {
      source: 'brain-film',
      title: '还没完成的小电影',
      description: '',
      aiTools: ['脑洞放映厅'],
      fileName: 'film.bhfilm',
      blob: new Blob(['{}']),
    })

    render(
      <AppStateProvider>
        <WorksProvider accountId="student-a" repository={repository}>
          <WorksGalleryPage onBack={vi.fn()} onWorkClick={vi.fn()} />
        </WorksProvider>
      </AppStateProvider>,
    )

    expect((await screen.findAllByText('会分类的小车')).length).toBeGreaterThan(0)
    expect(screen.queryByText('还没完成的小电影')).not.toBeInTheDocument()
    const publishedCard = (await screen.findAllByText('会分类的小车'))[0].closest('article')
    expect(publishedCard).not.toBeNull()
    await user.click(within(publishedCard!).getByRole('button', { name: '点赞作品' }))
    expect((await repository.get('student-a', published.id))?.likes).toBe(1)
    expect((await repository.get('student-a', draft.id))?.likes).toBe(0)
  })

  it('在精选列表和全部作品中复用演示作品媒体', async () => {
    const repository = createMemoryWorkRepository()
    const work = await repository.saveDraft('student-a', {
      source: 'brain-film',
      sourceDraftId: 'demo-video-1',
      title: '会呼吸的时钟',
      description: '',
      aiTools: ['智芽创意助手'],
      fileName: 'clockwork-morning.mp4',
      blob: new Blob(['preview'], { type: 'video/mp4' }),
    })
    await repository.setStatus('student-a', work.id, 'published')

    render(
      <AppStateProvider>
        <WorksProvider accountId="student-a" repository={repository}>
          <WorksGalleryPage onBack={vi.fn()} />
        </WorksProvider>
      </AppStateProvider>,
    )

    const previews = await screen.findAllByRole('img', { name: '会呼吸的时钟' })
    expect(previews).toHaveLength(2)
    expect(previews.every((preview) => (
      preview.getAttribute('src') === '/demo-works/posters/clockwork-morning.jpg'
    ))).toBe(true)
  })

  it('展示多名同学的作品作者而不是统一显示当前账号', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    await seedDemoWorks(
      repository,
      '123',
      async (path) => new Blob([path], {
        type: path.endsWith('.mp4') ? 'video/mp4' : 'image/webp',
      }),
      new Date(),
    )

    render(
      <AppStateProvider>
        <WorksProvider accountId="123" repository={repository}>
          <WorksGalleryPage onBack={vi.fn()} />
        </WorksProvider>
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '每年' }))
    for (const name of ['晨曦同学', '乐乐', '星禾', '米粒', '小宇', '朵朵', '安安']) {
      expect((await screen.findAllByText(new RegExp(`^${name} ·`))).length).toBeGreaterThan(0)
    }
  })
})
