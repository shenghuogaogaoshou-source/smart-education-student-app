import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { createMemoryWorkRepository } from '../works/memoryRepository'
import { WorksProvider } from '../works/WorksProvider'
import { FavoritesPage } from './FavoritesPage'

describe('favorites page', () => {
  it('shows favorited imported works and opens the real work detail target', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    const onWorkClick = vi.fn()
    render(
      <AppStateProvider>
        <WorksProvider accountId="123" repository={repository}>
          <FavoritesPage onBack={() => undefined} onWorkClick={onWorkClick} />
        </WorksProvider>
      </AppStateProvider>,
    )

    const title = await screen.findByText('银发小小探索家')
    expect(screen.getByText('樱花下的小仓鼠')).toBeInTheDocument()
    expect(screen.getByText('溪边的小黄鸭')).toBeInTheDocument()
    await user.click(title.closest('button')!)
    expect(onWorkClick).toHaveBeenCalledWith(expect.stringMatching(/^memory-/))
  })
})
