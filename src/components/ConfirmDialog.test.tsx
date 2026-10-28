import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('runs cancellation and confirmation only after their matching action', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="删除作品？"
        description="删除后不能恢复。"
        confirmLabel="确认删除"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog', { name: '删除作品？' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('prevents duplicate confirmation while deletion is running', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        busy
        title="删除作品？"
        description="删除后不能恢复。"
        confirmLabel="确认删除"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    const confirm = screen.getByRole('button', { name: '正在删除…' })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
