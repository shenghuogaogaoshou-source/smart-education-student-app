import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestCompanionReply } from './companionChat'

describe('requestCompanionReply', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a trimmed student question to the protected companion endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: '当然可以，我们从一个小问题开始。' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestCompanionReply({ companionId: 'yunduo', question: '  彩虹为什么有颜色？  ' }))
      .resolves.toBe('当然可以，我们从一个小问题开始。')

    expect(fetchMock).toHaveBeenCalledWith('/api/companion/reply', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ companionId: 'yunduo', question: '彩虹为什么有颜色？' }),
    }))
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(requestInit.headers).get('content-type')).toBe('application/json')
  })

  it('keeps a failed request from exposing service details to the student', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'provider secret' }), { status: 500 })))

    await expect(requestCompanionReply({ companionId: 'momo', question: '什么是光合作用？' }))
      .rejects.toThrow('伙伴暂时没听清，我们换个简单的问题试试。')
  })

  it('normalizes the companion identity, limits the question and forwards cancellation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: '我们先看一个小线索。' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await requestCompanionReply({
      companionId: 'retired-companion',
      question: `  ${'问'.repeat(170)}  `,
      signal: controller.signal,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/companion/reply', expect.objectContaining({
      body: JSON.stringify({ companionId: 'momo', question: '问'.repeat(160) }),
    }))
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })

  it('retries one temporary provider failure before giving up', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'provider_error' }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: '我们再一起想想。' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestCompanionReply({ companionId: 'momo', question: '为什么天是蓝色的？' }))
      .resolves.toBe('我们再一起想想。')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
