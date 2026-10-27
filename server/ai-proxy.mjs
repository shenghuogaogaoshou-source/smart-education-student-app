import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { interpretCompanionIntent } from './companionIntent.mjs'
import { buildDeepSeekPayload, prepareStudentQuestion, prepareStudentReply } from './companionPolicy.mjs'
import { recognize } from './recognition.mjs'
import { synthesizeSpeech } from './tts.mjs'
import { buildSchedulePayload, normalizeScheduleRequest, validateScheduleResponse } from './schedulePolicy.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.COMPANION_PROXY_PORT ?? 8787)
const HOST = process.env.COMPANION_PROXY_HOST || '127.0.0.1'
const MAX_BODY_BYTES = 16 * 1024
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
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

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...CORS_HEADERS,
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
  { method, path, body },
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
    try {
      const result = await proxyJsonRequest({
        url: process.env.ARK_IMAGE_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        apiKey: arkApiKey,
        body: {
          ...body,
          model: arkImageModel || body?.model,
        },
        fetchImpl,
      })
      return { status: 200, body: result }
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

export function startProxyServer(port = PORT, host = HOST) {
  const server = createServer(async (request, response) => {
    const path = request.url?.split('?')[0] ?? ''
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS)
      response.end()
      return
    }
    if (request.method === 'POST' && path === '/api/tts') {
      try {
        const body = await readJson(request)
        const audio = await synthesizeSpeech(body?.text, body?.voice)
        response.writeHead(200, {
          'content-type': 'audio/mpeg',
          'cache-control': 'no-store',
          ...CORS_HEADERS,
        })
        response.end(audio)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'tts_failed'
        sendJson(response, code === 'invalid_input' || code === 'text_too_long' ? 400 : 502, {
          error: code === 'invalid_input' || code === 'text_too_long' ? code : 'tts_failed',
        })
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
      sendJson(response, code === 'body_too_large' ? 413 : 400, { error: code })
      return
    }
    const result = await handleCompanionApiRequest({ method: request.method, path, body })
    sendJson(response, result.status, result.body)
  })

  server.listen(port, host, () => {
    console.log(`AI companion proxy running at http://${host}:${port}`)
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) startProxyServer()
