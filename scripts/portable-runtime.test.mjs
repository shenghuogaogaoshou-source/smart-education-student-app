import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import {
  copyFfmpegRuntime,
  copyNodeRuntime,
  copyPythonRuntime,
  resolveRuntimeSources,
  verifyPortableRuntime,
} from './portable-runtime.mjs'

function createRuntimeFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-runtime-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const nodeRoot = join(root, 'node-source')
  const pythonRoot = join(root, 'python-source')
  const ffmpegRoot = join(root, 'ffmpeg-source')
  const ffmpegBin = join(ffmpegRoot, 'bin')
  const destination = join(root, 'runtime')

  for (const directory of [
    join(nodeRoot, 'node_modules', 'npm', 'bin'),
    join(pythonRoot, 'Lib', 'site-packages'),
    join(pythonRoot, 'Lib', '__pycache__'),
    ffmpegBin,
  ]) {
    mkdirSync(directory, { recursive: true })
  }

  writeFileSync(join(nodeRoot, 'node.exe'), 'node')
  writeFileSync(join(nodeRoot, 'LICENSE'), 'node license')
  writeFileSync(
    join(nodeRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    'npm cli',
  )
  writeFileSync(join(nodeRoot, 'node_modules', 'npm', 'LICENSE'), 'npm license')
  writeFileSync(join(pythonRoot, 'python.exe'), 'python')
  writeFileSync(join(pythonRoot, 'LICENSE.txt'), 'python license')
  writeFileSync(join(pythonRoot, 'Lib', 'os.py'), 'standard library')
  writeFileSync(join(pythonRoot, 'Lib', 'site-packages', 'cache.bin'), 'exclude')
  writeFileSync(join(pythonRoot, 'Lib', '__pycache__', 'cache.pyc'), 'exclude')
  writeFileSync(join(ffmpegBin, 'ffmpeg.exe'), 'ffmpeg')
  writeFileSync(join(ffmpegBin, 'ffprobe.exe'), 'ffprobe')
  writeFileSync(join(ffmpegRoot, 'LICENSE'), 'ffmpeg license')

  return { root, nodeRoot, pythonRoot, ffmpegRoot, ffmpegBin, destination }
}

test('resolves absolute runtime sources from explicit environment locations', (t) => {
  const fixture = createRuntimeFixture(t)
  const sources = resolveRuntimeSources({
    ZHIYA_PORTABLE_NODE_ROOT: fixture.nodeRoot,
    ZHIYA_PORTABLE_PYTHON_ROOT: fixture.pythonRoot,
    ZHIYA_PORTABLE_FFMPEG_ROOT: fixture.ffmpegBin,
  })

  assert.equal(sources.nodeRoot, resolve(fixture.nodeRoot))
  assert.equal(sources.pythonRoot, resolve(fixture.pythonRoot))
  assert.equal(sources.ffmpegBinRoot, resolve(fixture.ffmpegBin))
})

test('copies runtimes without caches or user packages and keeps licenses', (t) => {
  const fixture = createRuntimeFixture(t)

  copyNodeRuntime(fixture.nodeRoot, join(fixture.destination, 'node'))
  copyPythonRuntime(fixture.pythonRoot, join(fixture.destination, 'python'))
  copyFfmpegRuntime(fixture.ffmpegBin, join(fixture.destination, 'ffmpeg'))

  assert.equal(existsSync(join(fixture.destination, 'node', 'node.exe')), true)
  assert.equal(
    existsSync(
      join(
        fixture.destination,
        'node',
        'node_modules',
        'npm',
        'bin',
        'npm-cli.js',
      ),
    ),
    true,
  )
  assert.equal(
    readFileSync(join(fixture.destination, 'node', 'LICENSE'), 'utf8'),
    'node license',
  )
  assert.equal(
    existsSync(join(fixture.destination, 'python', 'Lib', 'os.py')),
    true,
  )
  assert.equal(
    existsSync(
      join(fixture.destination, 'python', 'Lib', 'site-packages'),
    ),
    false,
  )
  assert.equal(
    existsSync(join(fixture.destination, 'python', 'Lib', '__pycache__')),
    false,
  )
  assert.equal(
    readFileSync(join(fixture.destination, 'ffmpeg', 'LICENSE'), 'utf8'),
    'ffmpeg license',
  )
})

test('refuses missing executables and reports verified runtime versions', (t) => {
  const fixture = createRuntimeFixture(t)
  const missingNode = join(fixture.root, 'missing-node')
  mkdirSync(missingNode)

  assert.throws(() => copyNodeRuntime(missingNode, join(fixture.root, 'out')))
  assert.throws(() =>
    copyPythonRuntime(fixture.pythonRoot, fixture.pythonRoot),
  )

  copyNodeRuntime(fixture.nodeRoot, join(fixture.destination, 'node'))
  copyPythonRuntime(fixture.pythonRoot, join(fixture.destination, 'python'))
  copyFfmpegRuntime(fixture.ffmpegBin, join(fixture.destination, 'ffmpeg'))

  const calls = []
  const report = verifyPortableRuntime(
    fixture.destination,
    ({ command, args }) => {
      calls.push({ command, args })
      return { status: 0, stdout: 'test-version\n', stderr: '' }
    },
  )

  assert.equal(calls.length, 5)
  assert.deepEqual(report.versions, {
    node: 'test-version',
    npm: 'test-version',
    python: 'test-version',
    ffmpeg: 'test-version',
    ffprobe: 'test-version',
  })
  assert.equal(dirname(report.nodePath), join(fixture.destination, 'node'))
})
