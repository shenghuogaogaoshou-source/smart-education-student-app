import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AiLocalSheet } from './AiLocalSheet'

function SheetHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>打开测试面板</button>
      {open && (
        <AiLocalSheet
          label="测试面板"
          eyebrow="只在本机"
          title="测试面板"
          triggerRef={triggerRef}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          footer={<button type="button">页脚操作</button>}
        >
          <button type="button">面板内容</button>
        </AiLocalSheet>
      )}
    </>
  )
}

describe('AiLocalSheet', () => {
  it('renders an app-contained sheet and restores focus after Escape', async () => {
    const user = userEvent.setup()
    render(<SheetHarness />)
    const trigger = screen.getByRole('button', { name: '打开测试面板' })

    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: '测试面板' })).toHaveClass('ai-local-sheet')
    expect(screen.getByTestId('ai-local-sheet-layer')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '测试面板' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes from the backdrop and loops keyboard focus inside the sheet', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SheetHarness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '打开测试面板' }))

    const footerButton = screen.getByRole('button', { name: '页脚操作' })
    footerButton.focus()
    await user.tab()
    expect(screen.getByRole('button', { name: '关闭测试面板' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '关闭测试面板遮罩' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
