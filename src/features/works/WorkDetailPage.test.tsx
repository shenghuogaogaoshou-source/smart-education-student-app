import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { createMemoryWorkRepository } from './memoryRepository'
import { WorkDetailPage } from './WorkDetailPage'
import { WorksProvider } from './WorksProvider'

describe('WorkDetailPage', () => {
  it('uses the shared mobile header when the work is unavailable', async () => {
    render(
      <AppStateProvider>
        <WorksProvider accountId="student-a" repository={createMemoryWorkRepository()}>
          <WorkDetailPage workId="missing" onBack={vi.fn()} />
        </WorksProvider>
      </AppStateProvider>,
    )

    expect(await screen.findByRole('button', { name: '返回' })).toHaveClass('mobile-page-header__back')
    expect(screen.getByRole('heading', { name: '作品详情' })).toBeVisible()
  })
})
