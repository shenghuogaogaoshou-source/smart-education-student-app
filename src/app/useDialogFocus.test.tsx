import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDialogFocus } from './useDialogFocus'

function FocusHarness() {
  const dialogRef = useDialogFocus<HTMLDivElement>(true)

  return (
    <div ref={dialogRef} role="dialog" aria-label="测试对话框">
      <div hidden>
        <button type="button">隐藏按钮</button>
      </div>
      <div aria-hidden="true">
        <button type="button">辅助隐藏按钮</button>
      </div>
      <div style={{ display: 'none' }}>
        <button type="button">CSS 显示隐藏按钮</button>
      </div>
      <div style={{ visibility: 'hidden' }}>
        <button type="button">CSS 可见性隐藏按钮</button>
      </div>
      <button type="button">可见按钮</button>
    </div>
  )
}

describe('useDialogFocus', () => {
  it('skips controls inside hidden, aria-hidden, and CSS-hidden ancestors when choosing initial focus', () => {
    render(<FocusHarness />)

    expect(screen.getByRole('button', { name: '可见按钮' })).toHaveFocus()
  })
})
