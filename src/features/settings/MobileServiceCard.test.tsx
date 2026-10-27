import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MobileServiceCard } from './MobileServiceCard'

describe('mobile service settings', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: { isNativePlatform: () => true },
    })
  })

  afterEach(() => {
    delete (window as Window & { Capacitor?: unknown }).Capacitor
  })

  it('saves separate AI and brain-film LAN origins', async () => {
    const user = userEvent.setup()
    render(<MobileServiceCard />)

    await user.clear(screen.getByLabelText('AI 服务地址'))
    await user.type(screen.getByLabelText('AI 服务地址'), '10.0.0.8:8787')
    await user.clear(screen.getByLabelText('脑洞服务地址'))
    await user.type(screen.getByLabelText('脑洞服务地址'), 'http://10.0.0.8:8766')
    await user.click(screen.getByRole('button', { name: '保存服务地址' }))

    expect(JSON.parse(localStorage.getItem('zhiya.mobileApiOrigins') ?? '{}')).toEqual({
      aiOrigin: 'http://10.0.0.8:8787',
      brainOrigin: 'http://10.0.0.8:8766',
    })
    expect(screen.getByRole('status')).toHaveTextContent('服务地址已保存')
  })
})
