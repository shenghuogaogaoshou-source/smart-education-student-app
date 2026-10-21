import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { FavoritesPage } from './FavoritesPage'

describe('favorites page', () => {
  it('shows only works shared by other learners', () => {
    render(<AppStateProvider><FavoritesPage onBack={() => undefined} /></AppStateProvider>)

    expect(screen.getByText('会分类的照相机')).toBeInTheDocument()
    expect(screen.getByText('未来图书馆')).toBeInTheDocument()
    expect(screen.getAllByText(/同学/).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('知识卡片')).not.toBeInTheDocument()
    expect(screen.queryByText('光合作用与呼吸作用的区别')).not.toBeInTheDocument()
  })
})
