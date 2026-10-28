import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MobilePageHeader } from './MobilePageHeader'

describe('MobilePageHeader', () => {
  it('renders one accessible back button, title and action slot', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <MobilePageHeader
        eyebrow="成长伙伴"
        title="作品管理"
        onBack={onBack}
        action={<button type="button">上传作品</button>}
      />,
    )

    expect(screen.getAllByRole('button', { name: '返回' })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: '作品管理' })).toBeVisible()
    expect(screen.getByText('成长伙伴')).toBeVisible()
    expect(screen.getByRole('button', { name: '上传作品' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
