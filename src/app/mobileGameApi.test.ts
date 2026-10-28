import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installGameApiShim } from '../../packages/works-bridge/src'

describe('embedded game mobile API bridge', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as Window & { Capacitor?: unknown }).Capacitor
    window.history.replaceState({}, '', '/')
  })

  it('derives the brain prefix from one API origin in the WebView', async () => {
    localStorage.setItem('zhiya.nativeApp', '1')
    localStorage.setItem('zhiya.mobileApiOrigins', JSON.stringify({
      aiOrigin: 'https://api.zhiya.test',
      brainOrigin: 'https://legacy-brain.test',
    }))
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('brain')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('https://api.zhiya.test/brain/api/health', undefined)
  })

  it('uses the same origin without a prefix for the creative module', async () => {
    localStorage.setItem('zhiya.nativeApp', '1')
    localStorage.setItem('zhiya.mobileApiOrigin', 'https://api.zhiya.test')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('ai')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('https://api.zhiya.test/api/health', undefined)
  })

  it('sends brain-game background tasks to the shared task API', async () => {
    window.history.replaceState({}, '', '/?apiOrigin=https%3A%2F%2Fapi.zhiya.test')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('brain')
    await fetch('/api/tasks', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledWith('https://api.zhiya.test/api/tasks', { method: 'POST' })
  })

  it('accepts one base origin explicitly from the parent WebView', async () => {
    window.history.replaceState({}, '', '/?apiOrigin=https%3A%2F%2Fapi.zhiya.test')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('brain')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('https://api.zhiya.test/brain/api/health', undefined)
  })

  it('leaves relative game API calls untouched outside the native app', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    installGameApiShim('ai')
    await fetch('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('/api/health')
  })
})
