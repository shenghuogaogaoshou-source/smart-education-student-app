import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadMobileApi() {
  vi.resetModules()
  return import('./mobileApi')
}

describe('mobile API configuration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('uses one fixed HTTPS origin for every production native service', async () => {
    vi.stubEnv('VITE_NATIVE_RELEASE', '1')
    vi.stubEnv('VITE_PRODUCTION_API_ORIGIN', 'https://api.zhiya.test')
    const { readMobileApiConfig, resolveApiUrl } = await loadMobileApi()

    expect(readMobileApiConfig(true)).toEqual({ apiOrigin: 'https://api.zhiya.test' })
    expect(resolveApiUrl('/api/health', 'ai', true)).toBe('https://api.zhiya.test/api/health')
    expect(resolveApiUrl('/api/health', 'brain', true)).toBe('https://api.zhiya.test/brain/api/health')
  })

  it('rejects a production origin that is not HTTPS', async () => {
    vi.stubEnv('VITE_NATIVE_RELEASE', '1')
    vi.stubEnv('VITE_PRODUCTION_API_ORIGIN', 'http://api.zhiya.test')
    const { readMobileApiConfig } = await loadMobileApi()

    expect(() => readMobileApiConfig(true)).toThrow(/HTTPS/)
  })

  it('migrates the legacy AI origin to one origin and derives the brain prefix', async () => {
    vi.stubEnv('VITE_NATIVE_RELEASE', '0')
    vi.stubEnv('VITE_PRODUCTION_API_ORIGIN', '')
    localStorage.setItem('zhiya.mobileApiOrigins', JSON.stringify({
      aiOrigin: 'https://api.zhiya.test',
      brainOrigin: 'https://legacy-brain.test',
    }))
    const { readMobileApiConfig, resolveApiUrl } = await loadMobileApi()

    expect(readMobileApiConfig(false)).toEqual({ apiOrigin: 'https://api.zhiya.test' })
    expect(localStorage.getItem('zhiya.mobileApiOrigin')).toBe('https://api.zhiya.test')
    expect(localStorage.getItem('zhiya.mobileApiOrigins')).toBeNull()
    expect(resolveApiUrl('/api/health', 'brain', true)).toBe('https://api.zhiya.test/brain/api/health')
  })

  it('keeps browser relative API calls working', async () => {
    vi.stubEnv('VITE_NATIVE_RELEASE', '0')
    const { resolveApiUrl } = await loadMobileApi()
    expect(resolveApiUrl('/api/companion/reply', 'ai', false)).toBe('/api/companion/reply')
  })

  it('recognizes a Capacitor native platform when isNativePlatform is unavailable', async () => {
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: { getPlatform: () => 'android' },
    })
    const { isNativeApp } = await loadMobileApi()

    expect(isNativeApp()).toBe(true)
    delete (window as Window & { Capacitor?: unknown }).Capacitor
  })
})
