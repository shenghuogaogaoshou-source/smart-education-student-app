import { describe, expect, it, vi } from 'vitest'
import { handleCompanionApiRequest } from './ai-proxy.mjs'

describe('AI companion proxy routes', () => {
  it('serves a locally validated intent from POST /api/companion/interpret', async () => {
    const interpretIntent = vi.fn(async () => ({
      kind: 'command',
      reply: '我们去知识页。',
      command: { type: 'navigate', target: 'knowledge' },
    }))

    const result = await handleCompanionApiRequest({
      method: 'POST',
      path: '/api/companion/interpret',
      body: { companionId: 'momo', text: '打开知识' },
    }, { apiKey: 'test-key', interpretIntent })

    expect(result).toEqual({
      status: 200,
      body: {
        kind: 'command',
        reply: '我们去知识页。',
        command: { type: 'navigate', target: 'knowledge' },
      },
    })
    expect(interpretIntent).toHaveBeenCalledWith(expect.objectContaining({
      companionId: 'momo',
      text: '打开知识',
      apiKey: 'test-key',
    }))
  })

  it('never treats a model/provider failure as an executable command', async () => {
    const result = await handleCompanionApiRequest({
      method: 'POST',
      path: '/api/companion/interpret',
      body: { companionId: 'momo', text: '打开知识' },
    }, {
      apiKey: 'test-key',
      interpretIntent: async () => { throw new Error('provider_error') },
    })

    expect(result).toEqual({ status: 502, body: { error: 'provider_error' } })
  })
})
