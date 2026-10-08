import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { AiCompanion } from './AiCompanion'
import { classifyDemoCommand } from './safety'

afterEach(() => vi.useRealTimers())

describe('temporary AI companion', () => {
  it('classifies unclear and risk-sensitive demo commands deterministically', () => {
    expect(classifyDemoCommand('那个帮我弄一下')).toBe('unclear')
    expect(classifyDemoCommand('把明天的学习安排改到晚上')).toBe('medium')
    expect(classifyDemoCommand('帮我修改账号密码')).toBe('high')
    expect(classifyDemoCommand('你真蠢')).toBe('blocked')
    expect(classifyDemoCommand('打开我的作品')).toBe('safe')
  })

  it('opens the full AI learning assistant on tap', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: 'AI伙伴' }))
    expect(screen.getByRole('dialog', { name: 'AI 学习伙伴' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /你的智能学习助教/ })).toBeInTheDocument()
  })

  it('opens the chat panel after a deliberate long press', () => {
    vi.useFakeTimers()
    render(<AppStateProvider><AiCompanion /></AppStateProvider>)
    const control = screen.getByRole('button', { name: 'AI伙伴' })

    fireEvent.pointerDown(control, { clientX: 300, clientY: 500, pointerId: 1 })
    act(() => vi.advanceTimersByTime(650))
    fireEvent.pointerUp(control, { clientX: 300, clientY: 500, pointerId: 1 })

    expect(screen.getByRole('dialog', { name: 'AI 学习伙伴' })).toBeInTheDocument()
  })
})
