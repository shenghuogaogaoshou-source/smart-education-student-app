import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import {
  buildCompletePackage,
  forbiddenPortablePath,
  portableProjectManifest,
} from './package-complete-app.mjs'

function createSourceProject(t) {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-package-source-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const relativePath of [
    'android/app/src/main',
    'src',
    'public/courses/qmx',
    'public/demo-works/videos',
    'server',
    'apps/brain-film/src',
    'apps/creative-module/src',
    'packages/task-client',
    'packages/works-bridge',
    'scripts',
    'docs',
    'templates',
    'node_modules/ignored',
    'dist',
    'android/app/build/outputs/apk',
  ]) {
    mkdirSync(join(root, relativePath), { recursive: true })
  }
  for (const relativePath of [
    'package.json',
    'package-lock.json',
    'index.html',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.server.config.ts',
    'capacitor.config.ts',
    '.npmrc',
    '.gitignore',
    'LICENSE',
    'README.md',
    'android/app/src/main/AndroidManifest.xml',
    'src/main.ts',
    'public/courses/qmx/page.png',
    'public/demo-works/videos/clock.mp4',
    'server/dev.mjs',
    'apps/brain-film/src/app.js',
    'apps/creative-module/src/app.js',
    'packages/task-client/package.json',
    'packages/works-bridge/package.json',
    'scripts/package-complete-app.mjs',
    'docs/README.md',
    'node_modules/ignored/index.js',
    'dist/index.html',
    'android/app/build/outputs/apk/app.apk',
    'server/.env.example',
  ]) {
    writeFileSync(join(root, relativePath), 'fixture')
  }
  return root
}

function createRuntimeSources(t) {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-package-runtime-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const nodeRoot = join(root, 'node')
  const pythonRoot = join(root, 'python')
  const ffmpegBinRoot = join(root, 'ffmpeg', 'bin')
  for (const directory of [
    join(nodeRoot, 'node_modules', 'npm', 'bin'),
    pythonRoot,
    ffmpegBinRoot,
  ]) {
    mkdirSync(directory, { recursive: true })
  }
  writeFileSync(join(nodeRoot, 'node.exe'), 'node')
  writeFileSync(join(nodeRoot, 'LICENSE'), 'node license')
  writeFileSync(
    join(nodeRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    'npm cli',
  )
  writeFileSync(join(pythonRoot, 'python.exe'), 'python')
  writeFileSync(join(pythonRoot, 'LICENSE.txt'), 'python license')
  writeFileSync(join(ffmpegBinRoot, 'ffmpeg.exe'), 'ffmpeg')
  writeFileSync(join(ffmpegBinRoot, 'ffprobe.exe'), 'ffprobe')
  writeFileSync(join(root, 'ffmpeg', 'LICENSE'), 'ffmpeg license')
  return { nodeRoot, pythonRoot, ffmpegBinRoot }
}

test('portable manifest covers app, backend, games, Android and minimal source', () => {
  const manifest = portableProjectManifest()
  for (const entry of [
    'android',
    'src',
    'public',
    'server',
    'apps',
    'packages',
    'scripts',
    'package.json',
    'package-lock.json',
    'capacitor.config.ts',
  ]) {
    assert.ok(manifest.includes(entry), entry)
  }
  assert.ok(!manifest.includes('.env'))
  assert.ok(!manifest.includes('node_modules'))
  assert.ok(!manifest.includes('dist'))
})

test('portable filter rejects credentials, dependencies and build artifacts', () => {
  for (const file of [
    '.git/config',
    '.worktrees/old/file',
    'node_modules/vite/package.json',
    'dist/index.html',
    'apps/brain-film/dist/index.html',
    'android/.gradle/file',
    'android/app/build/outputs/apk/app.apk',
    'android/app/.cxx/cache',
    'apps/brain-film/__pycache__/server.pyc',
    '.env',
    'server/.env.local',
    'apps/brain-film/.env',
    'release.jks',
    'release.keystore',
  ]) {
    assert.equal(forbiddenPortablePath(file), true, file)
  }
  assert.equal(forbiddenPortablePath('public/courses/qmx/page.png'), false)
  assert.equal(forbiddenPortablePath('server/.env.example'), false)
})

test('build creates an isolated candidate and injects delivery config last', async (t) => {
  const projectRoot = createSourceProject(t)
  const outputRoot = join(projectRoot, 'delivery')
  mkdirSync(outputRoot, { recursive: true })
  const runtimeSources = createRuntimeSources(t)
  const deliveryConfig = {
    'server/.env.local': 'FAKE_SERVER_VALUE',
    'apps/brain-film/.env': 'FAKE_FILM_VALUE',
  }
  let installed = false

  const result = await buildCompletePackage({
    projectRoot,
    outputRoot,
    runtimeSources,
    deliveryConfig,
    keepStage: true,
    installDependencies: async (stagedProjectRoot) => {
      installed = true
      for (const packageName of ['task-client', 'works-bridge']) {
        const directory = join(
          stagedProjectRoot,
          'node_modules',
          '@zhiya',
          packageName,
        )
        mkdirSync(directory, { recursive: true })
        writeFileSync(join(directory, 'package.json'), '{}')
      }
    },
    verifyRuntime: () => ({
      nodePath: 'runtime/node/node.exe',
      versions: {
        node: 'v24',
        npm: '11',
        python: '3.12',
        ffmpeg: '9',
        ffprobe: '9',
      },
    }),
    zipBuilder: (_sourceDirectory, destinationZip) => {
      mkdirSync(dirname(destinationZip), { recursive: true })
      writeFileSync(destinationZip, 'candidate zip')
    },
  })

  assert.equal(installed, true)
  assert.match(result.zipPath, /\.portable-candidate/)
  assert.match(result.sha256, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(result).includes('FAKE_SERVER_VALUE'), false)
  assert.equal(JSON.stringify(result).includes('FAKE_FILM_VALUE'), false)
})
