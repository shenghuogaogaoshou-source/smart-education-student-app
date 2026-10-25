import { describe, expect, it, vi } from 'vitest'
import { handleCompanionApiRequest, startProxyServer } from './ai-proxy.mjs'

describe('AI companion proxy routes', () => {
  it('returns 503 for a missing schedule key without exposing details', async () => {
    const result = await handleCompanionApiRequest({ method: 'POST', path: '/api/companion/schedule', body: {} }, { apiKey: '' })
    expect(result).toEqual({ status: 503, body: { error: 'missing_api_key' } })
  })

  it('rejects invalid schedule input before contacting DeepSeek', async () => {
    const fetchImpl = vi.fn()
    const result = await handleCompanionApiRequest({ method: 'POST', path: '/api/companion/schedule', body: {} }, { apiKey: 'fixture', fetchImpl })
    expect(result).toEqual({ status: 400, body: { error: 'invalid_input' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 400 invalid_input for inherited grade properties', async () => {
    const body = { grade: 'constructor', availability: [{ date: '2026-10-25', enabled: true, startTime: '18:00', endTime: '19:00', maxMinutes: 20 }],
      catalog: [{ partId: 'ael-4', kind: 'knowledge', title: 'test' }], progress: {} }
    const fetchImpl = vi.fn()
    expect(await handleCompanionApiRequest({ method: 'POST', path: '/api/companion/schedule', body }, { apiKey: 'fixture', fetchImpl }))
      .toEqual({ status: 400, body: { error: 'invalid_input' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends a filtered schedule request and returns server-validated tasks', async () => {
    const date = new Date()
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const body = {
      grade: 'grade5', phone: 'private',
      availability: [{ date: today, enabled: true, startTime: '00:00', endTime: '23:59', maxMinutes: 30 }],
      catalog: [{ partId: 'ael-4', kind: 'knowledge', title: '拆解', suggestedMinutes: 15 }],
      progress: { knowledgeCompleted: [], testsPassed: [] }, currentTasks: [], wrongQuestionSummaries: [],
    }
    const content = JSON.stringify({ tasks: [{ partId: 'ael-4', kind: 'knowledge', date: today,
      time: '23:00', minutes: 15, reason: '了解知识。' }], weekSummary: '探索一小步。' })
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), { status: 200 }))
    const result = await handleCompanionApiRequest({ method: 'POST', path: '/api/companion/schedule', body }, { apiKey: 'fixture', fetchImpl })
    expect(result.status).toBe(200)
    expect(result.body.tasks).toHaveLength(1)
    expect(result.body.tasks[0]).toMatchObject({ partId: 'ael-4', source: 'ai', title: '第一次 AI 实验' })
    expect(result.body.reasons[result.body.tasks[0].id]).toBe('了解知识。')
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init.headers.authorization).toBe('Bearer fixture')
    expect(init.body).not.toContain('private')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('maps malformed provider output and upstream errors to fixed, non-leaking 502 errors', async () => {
    const date = new Date()
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const body = {
      grade: 'grade5', availability: [{ date: today, enabled: true, startTime: '00:00', endTime: '23:59', maxMinutes: 30 }],
      catalog: [{ partId: 'ael-4', kind: 'knowledge', title: '拆解' }],
      progress: { knowledgeCompleted: [], testsPassed: [] },
    }
    const endpoint = { method: 'POST', path: '/api/companion/schedule', body }
    const invalid = await handleCompanionApiRequest(endpoint, { apiKey: 'fixture', fetchImpl: async () => new Response('{', { status: 200 }) })
    const failed = await handleCompanionApiRequest(endpoint, { apiKey: 'fixture', fetchImpl: async () => new Response('upstream-secret', { status: 500 }) })
    expect(invalid).toEqual({ status: 502, body: { error: 'invalid_result' } })
    expect(failed).toEqual({ status: 502, body: { error: 'provider_error' } })
  })

  it('accepts a bounded schedule request larger than the companion reply body limit', async () => {
    const server = startProxyServer(0)
    try {
      await new Promise((resolve) => server.once('listening', resolve))
      const result = await fetch(`http://127.0.0.1:${server.address().port}/api/companion/schedule`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grade: 'grade5', padding: 'x'.repeat(18 * 1024) }),
      })
      expect((await result.json()).error).toMatch(/^(missing_api_key|invalid_input)$/)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

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
