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

  it('proxies creative-module chat through the server key and supported model', async () => {
    const upstream = {
      id: 'chat-1',
      model: 'deepseek-flash',
      choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
    }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(upstream), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const result = await handleCompanionApiRequest({
      method: 'POST',
      path: '/api/deepseek/chat/completions',
      body: {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: '检查这个元件' }],
        response_format: { type: 'json_object' },
      },
    }, { apiKey: 'server-key', fetchImpl })

    expect(result).toEqual({ status: 200, body: upstream })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init.headers.authorization).toBe('Bearer server-key')
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: '检查这个元件' }],
      response_format: { type: 'json_object' },
    })
  })

  it('proxies creative-module image generation through the Ark server key', async () => {
    const upstream = { data: [{ b64_json: 'image-data' }] }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(upstream), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const result = await handleCompanionApiRequest({
      method: 'POST',
      path: '/api/ark/images/generations',
      body: { model: 'doubao-seedream-5-0-260128', prompt: '云朵小背包', size: '1024x1024' },
    }, { arkApiKey: 'ark-server-key', arkImageModel: 'ark-image-model', fetchImpl })

    expect(result).toEqual({ status: 200, body: upstream })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ark.cn-beijing.volces.com/api/v3/images/generations')
    expect(init.headers.authorization).toBe('Bearer ark-server-key')
    expect(JSON.parse(init.body)).toMatchObject({ prompt: '云朵小背包', model: 'ark-image-model' })
  })
})
