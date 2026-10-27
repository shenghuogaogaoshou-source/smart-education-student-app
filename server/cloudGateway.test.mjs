import { createServer, request as httpRequest } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createCloudGatewayListener } from './cloudGateway.mjs'

const openServers = new Set()

async function listen(listener) {
  const server = createServer(listener).listen(0, '127.0.0.1')
  openServers.add(server)
  await new Promise((resolve) => server.once('listening', resolve))
  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
  }
}

function rawRequest(origin, { path, method = 'GET', headers = {}, body = '' }) {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path,
      method,
      headers,
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }))
    })
    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

afterEach(async () => {
  await Promise.all([...openServers].map((server) => new Promise((resolve) => server.close(resolve))))
  openServers.clear()
})

describe('cloud API gateway', () => {
  it('delegates /api routes to the companion listener with security and allowlisted CORS headers', async () => {
    const companionListener = (request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, path: request.url }))
    }
    const gateway = await listen(createCloudGatewayListener({
      companionListener,
      allowedOrigins: new Set(['https://localhost']),
    }))

    const response = await fetch(`${gateway.origin}/api/health`, {
      headers: { origin: 'https://localhost' },
    })
    expect(await response.json()).toEqual({ ok: true, path: '/api/health' })
    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('proxies brain health and preserves ranged film responses byte-for-byte', async () => {
    let receivedRange = null
    const upstream = await listen((request, response) => {
      if (request.url === '/api/health') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true, service: 'brain' }))
        return
      }
      if (request.url === '/api/films/demo.mp4') {
        receivedRange = request.headers.range
        response.writeHead(206, {
          'content-type': 'video/mp4',
          'content-range': 'bytes 2-5/8',
          'accept-ranges': 'bytes',
        })
        response.end(Buffer.from([2, 3, 4, 5]))
        return
      }
      response.writeHead(404).end()
    })
    const gateway = await listen(createCloudGatewayListener({
      brainOrigin: upstream.origin,
      companionListener: (_request, response) => response.writeHead(404).end(),
    }))

    const health = await fetch(`${gateway.origin}/brain/api/health`)
    expect(await health.json()).toEqual({ ok: true, service: 'brain' })

    const film = await fetch(`${gateway.origin}/brain/api/films/demo.mp4`, {
      headers: { range: 'bytes=2-5' },
    })
    expect(film.status).toBe(206)
    expect(film.headers.get('content-range')).toBe('bytes 2-5/8')
    expect(film.headers.get('accept-ranges')).toBe('bytes')
    expect(Buffer.from(await film.arrayBuffer())).toEqual(Buffer.from([2, 3, 4, 5]))
    expect(receivedRange).toBe('bytes=2-5')
  })

  it('rejects encoded path traversal before contacting the brain service', async () => {
    let upstreamCalls = 0
    const upstream = await listen((_request, response) => {
      upstreamCalls += 1
      response.writeHead(200).end('unexpected')
    })
    const gateway = await listen(createCloudGatewayListener({
      brainOrigin: upstream.origin,
      companionListener: (_request, response) => response.writeHead(404).end(),
    }))

    const response = await rawRequest(gateway.origin, {
      path: '/brain/%2e%2e/%2e%2e/server/.env',
    })
    expect(response.status).toBe(400)
    expect(JSON.parse(response.body.toString())).toEqual({ error: 'invalid_path' })
    expect(upstreamCalls).toBe(0)
  })

  it('returns generic 413 and 429 errors for oversized requests and bursts', async () => {
    const companionListener = (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
    }
    const oversizedGateway = await listen(createCloudGatewayListener({
      companionListener,
      maxBodyBytes: 8,
    }))
    const oversized = await rawRequest(oversizedGateway.origin, {
      path: '/api/companion/reply',
      method: 'POST',
      headers: { 'content-length': '9', 'content-type': 'application/json' },
      body: '123456789',
    })
    expect(oversized.status).toBe(413)
    expect(JSON.parse(oversized.body.toString())).toEqual({ error: 'request_too_large' })

    const rateGateway = await listen(createCloudGatewayListener({
      companionListener,
      rateLimit: { requests: 2, windowMs: 60_000 },
    }))
    expect((await fetch(`${rateGateway.origin}/api/health`)).status).toBe(200)
    expect((await fetch(`${rateGateway.origin}/api/health`)).status).toBe(200)
    const limited = await fetch(`${rateGateway.origin}/api/health`)
    expect(limited.status).toBe(429)
    expect(await limited.json()).toEqual({ error: 'rate_limited' })
  })
})
