import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { interpretCompanionIntent } from './companionIntent.mjs'
import { buildDeepSeekPayload, prepareStudentQuestion, prepareStudentReply } from './companionPolicy.mjs'
import { recognize } from './recognition.mjs'
import { synthesizeSpeech } from './tts.mjs'
import { buildSchedulePayload, normalizeScheduleRequest, validateScheduleResponse } from './schedulePolicy.mjs'
import { createTaskService } from './taskService.mjs'
import { createTaskExecutor } from './taskExecutors.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.COMPANION_PROXY_PORT ?? 8787)
const HOST = process.env.COMPANION_PROXY_HOST || '127.0.0.1'
const MAX_BODY_BYTES = 16 * 1024
const CORS_BASE_HEADERS = {
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-zhiya-request-id',
  'access-control-max-age': '86400',
}

loadLocalEnvironmentFiles([
  join(__dirname, '..', '.env.local'),
  join(__dirname, '.env.local'),
])

export function loadLocalEnvironmentFiles(paths, target = process.env) {
  for (const path of paths) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!match || target[match[1]]) continue
      target[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return target
}

export function parseAllowedOrigins(raw = process.env.ALLOWED_ORIGINS || '') {
  return new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))
}

function corsHeadersForRequest(request, allowedOrigins) {
  const origin = request.headers.origin
  const allowOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : allowedOrigins.has('*')
      ? '*'
      : null
  return {
    ...CORS_BASE_HEADERS,
    ...(allowOrigin ? { 'access-control-allow-origin': allowOrigin } : {}),
    ...(allowOrigin && allowOrigin !== '*' ? { vary: 'origin' } : {}),
  }
}

function sendJson(response, status, body, corsHeaders = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders,
  })
  response.end(JSON.stringify(body))
}

function readJson(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk)
      if (size > limit) {
        reject(new Error('body_too_large'))
        request.destroy()
        return
      }
      raw += chunk
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    request.on('error', reject)
  })
}

async function createReply(body, { apiKey = process.env.DEEPSEEK_API_KEY, fetchImpl = fetch } = {}) {
  const question = prepareStudentQuestion(body?.question, body?.companionId)
  if (question.directReply) return question.directReply
  if (!apiKey) throw new Error('missing_api_key')
  const upstream = await fetchImpl('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildDeepSeekPayload(question)),
  })

  if (!upstream.ok) throw new Error('provider_error')
  const data = await upstream.json()
  const content = data?.choices?.[0]?.message?.content
  return prepareStudentReply(content)
}

async function proxyJsonRequest({ url, apiKey, body, fetchImpl, signal }) {
  if (!apiKey) throw new Error('missing_api_key')
  const upstream = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!upstream.ok) throw new Error('provider_error')
  return upstream.json()
}

export async function handleCompanionApiRequest(
  { method, path, body, requestId },
  {
    apiKey = process.env.DEEPSEEK_API_KEY,
    arkApiKey = process.env.ARK_API_KEY,
    arkImageModel = process.env.ARK_IMAGE_MODEL || process.env.ARK_MODEL,
    visionApiKey = process.env.VISION_API_KEY,
    visionModel = process.env.VISION_MODEL || 'qwen3-vl-plus',
    fetchImpl = fetch,
    interpretIntent = interpretCompanionIntent,
    recognizeImage = recognize,
  } = {},
) {
  if (method === 'GET' && path === '/api/health') {
    return {
      status: 200,
      body: {
        ok: true,
        companion: { configured: Boolean(apiKey), provider: 'deepseek' },
        vision: { configured: Boolean(visionApiKey), provider: 'dashscope', model: visionModel },
      },
    }
  }
  if (method !== 'POST') return { status: 404, body: { error: 'not_found' } }
  if (path === '/api/companion/schedule') {
    if (!apiKey) return { status: 503, body: { error: 'missing_api_key' } }
    try {
      const requestTime = new Date()
      const schedule = normalizeScheduleRequest(body, requestTime)
      const upstream = await proxyJsonRequest({
        url: 'https://api.deepseek.com/chat/completions',
        apiKey,
        body: buildSchedulePayload(schedule),
        fetchImpl,
        signal: AbortSignal.timeout(15_000),
      })
      return { status: 200, body: validateScheduleResponse(upstream, schedule, requestTime) }
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      const safeCode = code === 'invalid_input' ? 'invalid_input'
        : code === 'invalid_result' || error instanceof SyntaxError ? 'invalid_result' : 'provider_error'
      return { status: safeCode === 'invalid_input' ? 400 : 502, body: { error: safeCode } }
    }
  }
  if (path === '/api/companion/recognize') {
    try {
      return { status: 200, body: { result: await recognizeImage(body) } }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'provider_error'
      const known = ['invalid_input', 'invalid_json', 'body_too_large', 'vision_not_configured', 'text_not_configured', 'invalid_result', 'result_too_long', 'provider_error']
      return {
        status: code.includes('not_configured') ? 503 : code.startsWith('invalid_') ? 400 : 502,
        body: { error: known.includes(code) ? code : 'provider_error' },
      }
    }
  }
  if (path === '/api/companion/interpret') {
    try {
      const result = await interpretIntent({
        companionId: body?.companionId,
        text: body?.text,
        apiKey,
        fetchImpl,
      })
      return { status: 200, body: result }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'provider_error'
      const known = ['missing_api_key', 'invalid_intent', 'provider_error']
      return {
        status: code === 'missing_api_key' ? 503 : code === 'invalid_intent' ? 400 : 502,
        body: { error: known.includes(code) ? code : 'provider_error' },
      }
    }
  }
  if (path === '/api/deepseek/chat/completions') {
    try {
      const result = await proxyJsonRequest({
        url: 'https://api.deepseek.com/chat/completions',
        apiKey,
        body: {
          ...body,
          model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
        },
        fetchImpl,
      })
      return { status: 200, body: result }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'provider_error'
      return { status: code === 'missing_api_key' ? 503 : 502, body: { error: code } }
    }
  }
  if (path === '/api/ark/images/generations') {
    const endpoint = process.env.ARK_IMAGE_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
    const imageModel = arkImageModel || body?.model
    const retryable = new Set([408, 429, 500, 502, 503, 504])
    let lastStatus = 0
    if (!arkApiKey) return { status: 503, body: { error: 'missing_api_key' } }

    try {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        let upstream
        try {
          upstream = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${arkApiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ ...body, model: imageModel }),
          })
        } catch {
          lastStatus = 0
          if (attempt === 2) throw new Error('provider_error')
          await new Promise((resolve) => setTimeout(resolve, 180))
          continue
        }

        lastStatus = upstream.status
        if (upstream.ok) return { status: 200, body: await upstream.json() }
        if (!retryable.has(upstream.status) || attempt === 2) break
        console.warn('[image-generation]', {
          requestId: requestId || 'unknown',
          attempt,
          status: upstream.status,
          error: 'provider_error_retry',
        })
        await new Promise((resolve) => setTimeout(resolve, 180))
      }
      console.warn('[image-generation]', {
        requestId: requestId || 'unknown',
        attempts: 2,
        status: lastStatus,
        error: 'provider_error',
      })
      return { status: 502, body: { error: 'provider_error' } }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'provider_error'
      return { status: code === 'missing_api_key' ? 503 : 502, body: { error: code } }
    }
  }
  if (path !== '/api/companion/reply') return { status: 404, body: { error: 'not_found' } }

  try {
    const reply = await createReply(body, { apiKey, fetchImpl })
    return { status: 200, body: { reply } }
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error'
    const status = code === 'missing_api_key' ? 503 : code === 'invalid_question' || code === 'unsafe_question' ? 400 : 502
    return { status, body: { error: code } }
  }
}

export function createCompanionRequestListener({
  allowedOrigins = parseAllowedOrigins(),
  handleApi = handleCompanionApiRequest,
  createReply: createReplyImpl = createReply,
  synthesize = synthesizeSpeech,
  brainOrigin = process.env.BRAIN_INTERNAL_ORIGIN || '',
  taskService,
} = {}) {
  const tasks = taskService || createTaskService({
    dataDir: join(process.env.DATA_DIR || join(__dirname, '..', '.data'), 'tasks'),
    execute: createTaskExecutor({ handleApi, brainOrigin: brainOrigin || 'http://127.0.0.1:8766' }),
  })
  const taskReady = typeof tasks.start === 'function' ? tasks.start() : Promise.resolve()

  return async function companionRequestListener(request, response) {
    const path = request.url?.split('?')[0] ?? ''
    const corsHeaders = corsHeadersForRequest(request, allowedOrigins)
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders)
      response.end()
      return
    }

    if (request.method === 'POST' && path === '/api/tasks') {
      try {
        const body = await readJson(request, 8 * 1024 * 1024)
        await taskReady
        const task = await tasks.create(body)
        sendJson(response, 202, task, corsHeaders)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'invalid_input'
        sendJson(response, code === 'body_too_large' ? 413 : code === 'invalid_input' ? 400 : 503, {
          error: code === 'body_too_large' ? 'body_too_large' : code === 'invalid_input' ? 'invalid_input' : 'task_service_unavailable',
        }, corsHeaders)
      }
      return
    }

    const taskMatch = path.match(/^\/api\/tasks\/([0-9a-f-]{36})$/)
    if (request.method === 'GET' && taskMatch) {
      await taskReady
      const task = tasks.get(taskMatch[1])
      if (!task) {
        sendJson(response, 404, { error: 'task_not_found' }, corsHeaders)
      } else {
        sendJson(response, 200, task, corsHeaders)
      }
      return
    }

    if (request.method === 'POST' && path === '/api/companion/reply/stream') {
      let body
      try {
        body = await readJson(request)
        const reply = await createReplyImpl(body)
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          'x-accel-buffering': 'no',
          ...corsHeaders,
        })
        for (let index = 0; index < reply.length; index += 10) {
          const text = reply.slice(index, index + 10)
          response.write(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`)
        }
        response.write(`event: done\ndata: ${JSON.stringify({ reply })}\n\n`)
        response.end()
      } catch (error) {
        const code = error instanceof Error ? error.message : 'provider_error'
        sendJson(response, code === 'invalid_json' ? 400 : 502, {
          error: code === 'invalid_json' ? 'invalid_json' : 'provider_error',
        }, corsHeaders)
      }
      return
    }

    if (request.method === 'POST' && path === '/api/tts') {
      try {
        const body = await readJson(request)
        let audio
        let contentType = 'audio/mpeg'
        if (brainOrigin) {
          const upstream = await fetch(brainOrigin.replace(/\/$/, '') + '/api/tts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: body?.text, voice: body?.voice }),
            signal: AbortSignal.timeout(30_000),
          })
          if (!upstream.ok) throw new Error('tts_failed')
          audio = Buffer.from(await upstream.arrayBuffer())
          contentType = upstream.headers.get('content-type') || 'audio/wav'
        } else {
          audio = await synthesize(body?.text, body?.voice)
        }
        response.writeHead(200, {
          'content-type': contentType,
          'cache-control': 'no-store',
          ...corsHeaders,
        })
        response.end(audio)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'tts_failed'
        sendJson(response, code === 'invalid_input' || code === 'text_too_long' ? 400 : 502, {
          error: code === 'invalid_input' || code === 'text_too_long' ? code : 'tts_failed',
        }, corsHeaders)
      }
      return
    }
    const limit = path === '/api/companion/schedule'
      ? 64 * 1024
      : path === '/api/companion/recognize'
      ? 7 * 1024 * 1024
      : path === '/api/deepseek/chat/completions'
        ? 1024 * 1024
        : path === '/api/ark/images/generations'
          ? 256 * 1024
          : MAX_BODY_BYTES
    let body = {}
    try {
      body = await readJson(request, limit)
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid_json'
      sendJson(response, code === 'body_too_large' ? 413 : 400, { error: code }, corsHeaders)
      return
    }
    const result = await handleApi({
      method: request.method,
      path,
      body,
      requestId: String(request.headers['x-zhiya-request-id'] || ''),
    })
    sendJson(response, result.status, result.body, corsHeaders)
  }
}

export function startProxyServer(port = PORT, host = HOST) {
  const localAllowedOrigins = process.env.ALLOWED_ORIGINS
    ? parseAllowedOrigins()
    : new Set(['*'])
  const server = createServer(createCompanionRequestListener({ allowedOrigins: localAllowedOrigins }))

  server.listen(port, host, () => {
    console.log(`AI companion proxy running at http://${host}:${port}`)
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) startProxyServer()
