import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildChildSpecs } from './start-container.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('Docker image contains the mixed Node, Python, FFmpeg and Chinese font runtime', () => {
  const dockerfile = read('deploy/aliyun/Dockerfile')
  assert.match(dockerfile, /node:22-bookworm-slim/)
  assert.match(dockerfile, /python3/)
  assert.match(dockerfile, /ffmpeg/)
  assert.match(dockerfile, /fonts-noto-cjk/)
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*127\.0\.0\.1:8080\/api\/health/)
  assert.match(dockerfile, /DATA_DIR=\/data/)
})

test('container supervisor binds Python internally and exposes only the unified Node gateway', () => {
  const specs = buildChildSpecs(root)
  assert.equal(specs.length, 2)
  assert.deepEqual(specs[0].args.slice(-5), [
    join(root, 'apps', 'brain-film', 'server.py'),
    '--host',
    '127.0.0.1',
    '--port',
    '8766',
  ])
  assert.deepEqual(specs[1].args, [join(root, 'server', 'cloudGateway.mjs')])
  assert.equal(specs[1].env.HOST, '0.0.0.0')
  assert.equal(specs[1].env.PORT, '8080')
  assert.equal(specs[1].env.BRAIN_INTERNAL_ORIGIN, 'http://127.0.0.1:8766')
})

test('Compose keeps data persistent, secrets external and the app bound to loopback', () => {
  const compose = read('deploy/aliyun/compose.yaml')
  assert.match(compose, /127\.0\.0\.1:8080:8080/)
  assert.match(compose, /\/opt\/zhiya\/data:\/data/)
  assert.match(compose, /\/opt\/zhiya\/secrets\/zhiya\.env/)
  assert.match(compose, /restart:\s*unless-stopped/)
  assert.doesNotMatch(compose, /(?:sk-|ark-[a-z0-9-]{16,}|[A-Za-z0-9]{32}\.)/i)
})

test('Caddy terminates HTTPS and the environment template contains no credentials', () => {
  const caddyfile = read('deploy/aliyun/Caddyfile')
  const envExample = read('deploy/aliyun/.env.example')
  assert.match(caddyfile, /\{\$ZHIYA_API_DOMAIN\}/)
  assert.match(caddyfile, /reverse_proxy 127\.0\.0\.1:8080/)
  assert.doesNotMatch(envExample, /(?:sk-|ark-[a-z0-9-]{16,}|[A-Za-z0-9]{32}\.)/i)
  for (const name of [
    'DEEPSEEK_API_KEY',
    'VISION_API_KEY',
    'ZHIPU_API_KEY',
    'ARK_API_KEY',
    'VIDEO_API_KEY',
    'VOICE_API_KEY',
  ]) {
    assert.match(envExample, new RegExp(`^${name}=$`, 'm'))
  }
})

test('Docker build context excludes credentials, dependencies and local data', () => {
  const dockerignore = read('.dockerignore')
  assert.match(dockerignore, /^\.env\*?$/m)
  assert.match(dockerignore, /^node_modules\/$/m)
  assert.match(dockerignore, /^\.git\/$/m)
  assert.match(dockerignore, /^apps\/brain-film\/data\/$/m)
})
