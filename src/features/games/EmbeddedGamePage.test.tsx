import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmbeddedGamePage } from './EmbeddedGamePage'

describe('embedded game page', () => {
  it('在应用内加载游戏并可以返回首页', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<EmbeddedGamePage gameId="brain-film" onBack={onBack} />)

    const frame = screen.getByTitle('脑洞放映厅')
    expect(frame).toHaveAttribute('src', 'http://127.0.0.1:5191/?gameVersion=20261021-3')
    fireEvent.load(frame)
    expect(screen.getByText('游戏已就绪')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('启动失败时提供重试且重新挂载游戏', async () => {
    vi.useFakeTimers()
    render(<EmbeddedGamePage gameId="creative-module" onBack={vi.fn()} />)

    act(() => vi.advanceTimersByTime(5001))
    expect(screen.getByText('游戏暂时没有启动')).toBeInTheDocument()

    const firstFrame = screen.getByTitle('创造模块')
    fireEvent.click(screen.getByRole('button', { name: '重新加载游戏' }))
    expect(screen.queryByText('游戏暂时没有启动')).not.toBeInTheDocument()
    expect(screen.getByTitle('创造模块')).not.toBe(firstFrame)
    vi.useRealTimers()
  })
})
