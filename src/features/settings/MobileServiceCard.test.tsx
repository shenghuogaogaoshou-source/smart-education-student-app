import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('mobile service settings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
    vi.resetModules()
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: { isNativePlatform: () => true },
    })
  })

  afterEach(() => {
    delete (window as Window & { Capacitor?: unknown }).Capacitor
  })

  it('saves one debug service origin and tests both derived routes', async () => {
    vi.stubEnv('VITE_NATIVE_RELEASE', '0')
    const { MobileServiceCard } = await import('./MobileServiceCard')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<MobileServiceCard />)

    await user.type(screen.getByLabelText('服务根地址'), 'https://api.zhiya.test')
    await user.click(screen.getByRole('button', { name: '保存服务地址' }))

    expect(localStorage.getItem('zhiya.mobileApiOrigin')).toBe('https://api.zhiya.test')
    expect(screen.getByRole('status')).toHaveTextContent('服务地址已保存')

    await user.click(screen.getByRole('button', { name: '测试连接' }))
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.zhiya.test/api/health')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.zhiya.test/brain/api/health')
  })

  it('is hidden in a production Release APK', async () => {
    vi.stubEnv('VITE_NATIVE_RELEASE', '1')
    const { MobileServiceCard } = await import('./MobileServiceCard')
    render(<MobileServiceCard />)
    expect(screen.queryByText('移动端学习服务')).not.toBeInTheDocument()
  })
})
