import { describe, expect, it, vi } from 'vitest'
import { requestWithRetry } from './apiRequest'

describe('requestWithRetry', () => {
  it('retries one transient 502 response and preserves the request id', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":"provider_error"}', { status: 502 }))
      .mockResolvedValueOnce(new Response('{"reply":"你好"}', { status: 200 }))

    const response = await requestWithRetry('/api/companion/reply', {}, {
      fetcher,
      attempts: 2,
      requestId: 'req-test',
      retryDelayMs: 0,
    })

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-zhiya-request-id')).toBe('req-test')
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('x-zhiya-request-id')).toBe('req-test')
  })

  it('does not retry a 400 response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }))

    const response = await requestWithRetry('/api/test', {}, {
      fetcher,
      attempts: 2,
      retryDelayMs: 0,
    })

    expect(response.status).toBe(400)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not retry after the caller aborts the request', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      controller.abort()
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response('{}', { status: 502 })
    })

    await expect(requestWithRetry('/api/test', { signal: controller.signal }, {
      fetcher,
      attempts: 2,
      retryDelayMs: 0,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
