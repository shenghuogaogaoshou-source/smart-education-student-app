import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CompanionBubble } from './CompanionBubble'

describe('companion bubble', () => {
  it.each([
    ['listening', '请说，我在听'],
    ['transcribing', '我听到了'],
    ['thinking', '我想一想'],
    ['speaking', '正在回答'],
    ['error', '这次没有听清，可以再试一次'],
  ] as const)('shows the fixed child-friendly copy for %s', (state, message) => {
    render(<CompanionBubble state={state} />)

    expect(screen.getByRole('status')).toHaveTextContent(message)
  })

  it('shows a page reaction in idle state and lets the child dismiss it', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<CompanionBubble state="idle" message="这一关就在前面，我陪你一起试试！" onCancel={onCancel} />)

    expect(screen.getByRole('status')).toHaveTextContent('这一关就在前面')
    await user.click(screen.getByRole('button', { name: '收起伙伴提示' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
