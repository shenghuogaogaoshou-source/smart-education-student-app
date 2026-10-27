import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import {
  createCompanionRequestListener,
  handleCompanionApiRequest,
  loadLocalEnvironmentFiles,
  startProxyServer,
} from './ai-proxy.mjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('AI companion proxy routes', () => {
  it('reflects only explicitly allowed origins from the reusable listener', async () => {
    const listener = createCompanionRequestListener({
      allowedOrigins: new Set(['https://localhost']),
      handleApi: async () => ({ status: 200, body: { ok: true } }),
    })
    const server = createServer(listener).listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    try {
      const allowed = await fetch(`${origin}/api/health`, {
        headers: { origin: 'https://localhost' },
      })
      expect(allowed.status).toBe(200)
      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://localhost')

      const unknown = await fetch(`${origin}/api/health`, {
        headers: { origin: 'https://unknown.example' },
      })
      expect(unknown.status).toBe(200)
      expect(unknown.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('returns a non-secret health response through the reusable listener', async () => {
    const listener = createCompanionRequestListener({
      allowedOrigins: new Set(['https://localhost']),
      handleApi: async ({ method, path }) => ({
        status: method === 'GET' && path === '/api/health' ? 200 : 404,
        body: method === 'GET' && path === '/api/health'
          ? { ok: true, companion: { configured: true } }
          : { error: 'not_found' },
      }),
    })
    const server = createServer(listener).listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
        headers: { origin: 'https://localhost' },
      })
      const body = await response.json()
      expect(body).toEqual({ ok: true, companion: { configured: true } })
      expect(JSON.stringify(body)).not.toMatch(/secret|token|api.?key|process\.env/i)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('loads the root environment before the server fallback without replacing existing values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zhiya-env-'))
    const rootFile = join(dir, 'root.env')
    const serverFile = join(dir, 'server.env')
    writeFileSync(rootFile, 'VISION_MODEL=qwen3-vl-plus\nVISION_BASE_URL=https://root.example/v1\n')
    writeFileSync(serverFile, 'VISION_MODEL=server-model\nDEEPSEEK_MODEL=deepseek-flash\n')
    const target = {}
    loadLocalEnvironmentFiles([rootFile, serverFile], target)
    expect(target).toMatchObject({
      VISION_MODEL: 'qwen3-vl-plus',
      VISION_BASE_URL: 'https://root.example/v1',
      DEEPSEEK_MODEL: 'deepseek-flash',
    })
  })

  it('allows native WebView requests and CORS preflight', async () => {
    const server = startProxyServer(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    try {
      const preflight = await fetch(`${origin}/api/health`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://localhost',
          'access-control-request-method': 'GET',
        },
      })
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('access-control-allow-origin')).toBe('*')

      const health = await fetch(`${origin}/api/health`, {
        headers: { origin: 'https://localhost' },
      })
      expect(health.status).toBe(200)
      expect(health.headers.get('access-control-allow-origin')).toBe('*')
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('exposes a non-secret health summary even when vision is not configured', async () => {
    const result = await handleCompanionApiRequest({ method: 'GET', path: '/api/health', body: {} }, {
      apiKey: '', visionApiKey: '', visionModel: 'qwen3-vl-plus',
    })
    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        companion: { configured: false, provider: 'deepseek' },
        vision: { configured: false, provider: 'dashscope', model: 'qwen3-vl-plus' },
      },
    })
    expect(JSON.stringify(result)).not.toMatch(/sk-|api.?key/i)
  })
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
    expect(result.body.reasons[result.body.tasks[0].id]).toBe('了解《第一次 AI 实验》的知识内容。')
    expect(result.body.weekSummary).toBe('本周安排了1项课程学习，可按自己的节奏探索。')
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
