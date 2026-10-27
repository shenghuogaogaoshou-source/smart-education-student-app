import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCompanionRequestListener, parseAllowedOrigins } from './ai-proxy.mjs'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin) return {}
  if (allowedOrigins.has(origin)) {
    return { 'access-control-allow-origin': origin, vary: 'origin' }
  }
  return {}
}

function sendJson(response, status, body, headers = {}) {
  if (response.headersSent || response.destroyed) return
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...SECURITY_HEADERS,
    ...headers,
  })
  response.end(JSON.stringify(body))
}

function clientKey(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return request.socket.remoteAddress || 'unknown'
}

function createRateLimiter({ requests, windowMs }) {
  const clients = new Map()
  return function isLimited(request, now = Date.now()) {
    const key = clientKey(request)
    const current = clients.get(key)
    if (!current || now - current.startedAt >= windowMs) {
      clients.set(key, { count: 1, startedAt: now })
      return false
    }
    current.count += 1
    return current.count > requests
  }
}

function validateBrainPath(rawUrl) {
  const rawPath = (rawUrl || '').split('?')[0]
  if (!rawPath.startsWith('/brain/')) return null
  let decoded
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    return null
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return null
  const segments = decoded.split('/')
  if (segments.some((segment) => segment === '..' || segment === '.')) return null
  return (rawUrl || '').slice('/brain'.length)
}

function forwardedRequestHeaders(request, upstream) {
  const headers = {}
  for (const [name, value] of Object.entries(request.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(name) && name !== 'host' && value !== undefined) headers[name] = value
  }
  headers.host = upstream.host
  headers['x-forwarded-proto'] = 'https'
  return headers
}

function forwardedResponseHeaders(headers) {
  const safe = {}
  for (const [name, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(name) && value !== undefined) safe[name] = value
  }
  return safe
}

function proxyBrainRequest(request, response, { brainOrigin, forwardPath, maxBodyBytes, extraHeaders }) {
  const upstream = new URL(forwardPath, `${brainOrigin.replace(/\/$/, '')}/`)
  const requestImpl = upstream.protocol === 'https:' ? httpsRequest : httpRequest
  let settled = false
  let receivedBytes = 0
  const upstreamRequest = requestImpl(upstream, {
    method: request.method,
    headers: forwardedRequestHeaders(request, upstream),
  }, (upstreamResponse) => {
    if (settled) {
      upstreamResponse.resume()
      return
    }
    settled = true
    response.writeHead(upstreamResponse.statusCode || 502, {
      ...forwardedResponseHeaders(upstreamResponse.headers),
      ...SECURITY_HEADERS,
      ...extraHeaders,
    })
    upstreamResponse.pipe(response)
  })

  upstreamRequest.on('error', () => {
    if (settled) return
    settled = true
    sendJson(response, 502, { error: 'upstream_unavailable' }, extraHeaders)
  })

  request.on('data', (chunk) => {
    receivedBytes += chunk.length
    if (receivedBytes <= maxBodyBytes || settled) return
    settled = true
    upstreamRequest.destroy()
    sendJson(response, 413, { error: 'request_too_large' }, extraHeaders)
  })
  request.pipe(upstreamRequest)
}

export function createCloudGatewayListener({
  brainOrigin = process.env.BRAIN_INTERNAL_ORIGIN || 'http://127.0.0.1:8766',
  allowedOrigins = parseAllowedOrigins(),
  companionListener,
  rateLimit = { requests: 240, windowMs: 60_000 },
  maxBodyBytes = 8 * 1024 * 1024,
} = {}) {
  const handleCompanion = companionListener || createCompanionRequestListener({ allowedOrigins })
  const isRateLimited = createRateLimiter(rateLimit)

  return async function cloudGatewayListener(request, response) {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : ''
    const requestCorsHeaders = corsHeaders(origin, allowedOrigins)
    for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...requestCorsHeaders })) {
      response.setHeader(name, value)
    }

    if (isRateLimited(request)) {
      sendJson(response, 429, { error: 'rate_limited' }, requestCorsHeaders)
      return
    }

    const declaredLength = Number(request.headers['content-length'] || 0)
    if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > maxBodyBytes) {
      sendJson(response, 413, { error: 'request_too_large' }, requestCorsHeaders)
      return
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,range',
        'access-control-max-age': '86400',
        ...requestCorsHeaders,
      })
      response.end()
      return
    }

    const rawUrl = request.url || '/'
    if (rawUrl.startsWith('/api/')) {
      await handleCompanion(request, response)
      return
    }

    if (rawUrl.startsWith('/brain/')) {
      const forwardPath = validateBrainPath(rawUrl)
      if (!forwardPath) {
        sendJson(response, 400, { error: 'invalid_path' }, requestCorsHeaders)
        return
      }
      proxyBrainRequest(request, response, {
        brainOrigin,
        forwardPath,
        maxBodyBytes,
        extraHeaders: requestCorsHeaders,
      })
      return
    }

    sendJson(response, 404, { error: 'not_found' }, requestCorsHeaders)
  }
}

export function startCloudGateway({
  port = Number(process.env.PORT || 8080),
  host = process.env.HOST || '0.0.0.0',
  brainOrigin = process.env.BRAIN_INTERNAL_ORIGIN || 'http://127.0.0.1:8766',
} = {}) {
  const server = createServer(createCloudGatewayListener({ brainOrigin }))
  server.listen(port, host, () => {
    console.log(`Zhiya cloud gateway running at http://${host}:${port}`)
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  startCloudGateway()
}
