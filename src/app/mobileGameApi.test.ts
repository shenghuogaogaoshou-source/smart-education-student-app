import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installGameApiShim } from '../../packages/works-bridge/src'

describe('embedded game mobile API bridge', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as Window & { Capacitor?: unknown }).Capacitor
    window.history.replaceState({}, '', '/')
  })

  it('routes brain-film API calls to the configured LAN server inside the WebView', async () => {
    localStorage.setItem('zhiya.nativeApp', '1')
    localStorage.setItem('zhiya.mobileApiOrigins', JSON.stringify({
      aiOrigin: 'http://10.0.0.8:8787',
      brainOrigin: 'http://10.0.0.8:8766',
    }))
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('brain')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.0.8:8766/api/health', undefined)
  })

  it('accepts an API origin passed explicitly by the parent WebView', async () => {
    window.history.replaceState({}, '', '/?apiOrigin=http%3A%2F%2F10.0.0.9%3A8766')
    expect(window.location.search).toContain('apiOrigin')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('brain')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('http://10.0.0.9:8766/api/health', undefined)
  })

  it('leaves relative game API calls untouched outside the native app', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('ai')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('/api/health')
  })
})
