import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { verifyPortablePackage } from './verify-portable-package.mjs'

function createPackageZip(t, { includeRuntime = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-verify-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const payloadRoot = join(root, 'payload')
  const packageRoot = join(payloadRoot, '智芽-Web完整演示包')
  for (const directory of [
    join(packageRoot, 'launcher'),
    join(packageRoot, 'runtime', 'node'),
    join(packageRoot, 'runtime', 'python'),
    join(packageRoot, 'runtime', 'ffmpeg'),
    join(packageRoot, 'project', 'node_modules', '@zhiya', 'task-client'),
    join(packageRoot, 'project', 'node_modules', '@zhiya', 'works-bridge'),
    join(packageRoot, 'project', 'public', 'demo-works', 'images'),
    join(packageRoot, 'project', 'server'),
  ]) {
    mkdirSync(directory, { recursive: true })
  }
  writeFileSync(join(packageRoot, '启动.cmd'), '@echo off\n')
  writeFileSync(join(packageRoot, 'launcher', 'start.ps1'), '# launcher\n')
  writeFileSync(join(packageRoot, 'project', 'package.json'), '{"version":"1.2.3"}')
  writeFileSync(
    join(packageRoot, 'project', 'node_modules', '@zhiya', 'task-client', 'package.json'),
    '{}',
  )
  writeFileSync(
    join(packageRoot, 'project', 'node_modules', '@zhiya', 'works-bridge', 'package.json'),
    '{}',
  )
  writeFileSync(
    join(packageRoot, 'project', 'public', 'demo-works', 'images', 'cloud-seed.webp'),
    'image',
  )
  writeFileSync(
    join(packageRoot, 'project', 'server', '.env.local'),
    'VERIFY_SECRET_FIXTURE',
  )
  if (includeRuntime) {
    for (const [relativePath, content] of [
      ['runtime/node/node.exe', 'node'],
      ['runtime/python/python.exe', 'python'],
      ['runtime/ffmpeg/ffmpeg.exe', 'ffmpeg'],
      ['runtime/ffmpeg/ffprobe.exe', 'ffprobe'],
    ]) {
      writeFileSync(join(packageRoot, relativePath), content)
    }
  }

  const zipPath = join(root, '智芽 candidate.zip')
  const python = process.platform === 'win32' ? 'py' : 'python3'
  const pythonArgs = process.platform === 'win32' ? ['-3.12', '-c'] : ['-c']
  const zipScript = [
    'import pathlib, sys, zipfile',
    'root = pathlib.Path(sys.argv[1])',
    'target = pathlib.Path(sys.argv[2])',
    'with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:',
    '    for path in root.rglob("*"):',
    '        if path.is_file(): archive.write(path, path.relative_to(root))',
  ].join('\n')
  const result = spawnSync(
    python,
    [...pythonArgs, zipScript, payloadRoot, zipPath],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  return { root, zipPath }
}

function successfulFetch(url) {
  const path = new URL(url).pathname
  if (path === '/api/health') {
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
  }
  return Promise.resolve(new Response('<div id="root"></div>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }))
}

test('rejects a package that is missing bundled runtimes', async (t) => {
  const fixture = createPackageZip(t, { includeRuntime: false })
  await assert.rejects(
    () => verifyPortablePackage({
      zipPath: fixture.zipPath,
      extractionRoot: join(fixture.root, 'extract'),
      launchPackage: async () => ({ stop: async () => {} }),
      fetchImpl: successfulFetch,
    }),
    /runtime/i,
  )
})

test('extracts a Chinese path, starts, checks endpoints and omits secrets', async (t) => {
  const fixture = createPackageZip(t)
  let stopped = false
  const report = await verifyPortablePackage({
    zipPath: fixture.zipPath,
    extractionRoot: join(fixture.root, '解压 验证'),
    launchPackage: async ({ packageRoot, environment }) => {
      assert.match(packageRoot, /智芽-Web完整演示包$/)
      assert.equal(environment.ZHIYA_NO_BROWSER, '1')
      assert.equal(environment.ZHIYA_NONINTERACTIVE, '1')
      return {
        stop: async () => {
          stopped = true
        },
      }
    },
    fetchImpl: successfulFetch,
    checkPortsReleased: false,
  })

  assert.equal(stopped, true)
  assert.equal(report.status, 'passed')
  assert.equal(report.version, '1.2.3')
  assert.equal(Object.keys(report.endpoints).length, 5)
  assert.equal(report.endpoints['http://127.0.0.1:5173/'].status, 200)
  assert.equal(JSON.stringify(report).includes('VERIFY_SECRET_FIXTURE'), false)
  assert.equal(
    readFileSync(report.reportPath, 'utf8').includes('VERIFY_SECRET_FIXTURE'),
    false,
  )
})

test('fails cleanly when a health endpoint never responds', async (t) => {
  const fixture = createPackageZip(t)
  await assert.rejects(
    () => verifyPortablePackage({
      zipPath: fixture.zipPath,
      extractionRoot: join(fixture.root, 'extract'),
      launchPackage: async () => ({ stop: async () => {} }),
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED')
      },
      healthTimeoutMs: 60,
    }),
    /health endpoint/i,
  )
})
