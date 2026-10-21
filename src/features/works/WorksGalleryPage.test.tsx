import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
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
    const likes = screen.getAllByRole('button', { name: '点赞作品' })
    await user.click(likes[0])
    expect((await repository.get('student-a', published.id))?.likes).toBe(1)
    expect((await repository.get('student-a', draft.id))?.likes).toBe(0)
  })
})
