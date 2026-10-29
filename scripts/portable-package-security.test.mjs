import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildCompletePackage } from './package-complete-app.mjs'

test('delivery secrets exist only in the extracted project configuration', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-package-security-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const projectRoot = join(root, 'source')
  const outputRoot = join(root, 'output')
  for (const relativePath of [
    'src',
    'public',
    'server',
    'apps/brain-film',
    'apps/creative-module',
    'packages/task-client',
    'packages/works-bridge',
    'scripts',
    'docs',
    'templates',
    'android',
  ]) {
    mkdirSync(join(projectRoot, relativePath), { recursive: true })
  }
  for (const file of [
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
    'server/.env.example',
  ]) {
    writeFileSync(join(projectRoot, file), 'fixture')
  }
  mkdirSync(outputRoot, { recursive: true })

  const runtimeRoot = join(root, 'runtime-source')
  for (const directory of [
    join(runtimeRoot, 'node', 'node_modules', 'npm', 'bin'),
    join(runtimeRoot, 'python'),
    join(runtimeRoot, 'ffmpeg', 'bin'),
  ]) {
    mkdirSync(directory, { recursive: true })
  }
  writeFileSync(join(runtimeRoot, 'node', 'node.exe'), 'node')
  writeFileSync(join(runtimeRoot, 'node', 'LICENSE'), 'license')
  writeFileSync(
    join(runtimeRoot, 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    'npm',
  )
  writeFileSync(join(runtimeRoot, 'python', 'python.exe'), 'python')
  writeFileSync(join(runtimeRoot, 'python', 'LICENSE.txt'), 'license')
  writeFileSync(join(runtimeRoot, 'ffmpeg', 'bin', 'ffmpeg.exe'), 'ffmpeg')
  writeFileSync(join(runtimeRoot, 'ffmpeg', 'bin', 'ffprobe.exe'), 'ffprobe')
  writeFileSync(join(runtimeRoot, 'ffmpeg', 'LICENSE'), 'license')

  const result = await buildCompletePackage({
    projectRoot,
    outputRoot,
    runtimeSources: {
      nodeRoot: join(runtimeRoot, 'node'),
      pythonRoot: join(runtimeRoot, 'python'),
      ffmpegBinRoot: join(runtimeRoot, 'ffmpeg', 'bin'),
    },
    deliveryConfig: {
      'server/.env.local': 'SECRET_SERVER_FIXTURE',
      'apps/brain-film/.env': 'SECRET_FILM_FIXTURE',
    },
    keepStage: true,
    installDependencies: async (stagedProjectRoot) => {
      const scopedRoot = join(stagedProjectRoot, 'node_modules', '@zhiya')
      mkdirSync(scopedRoot, { recursive: true })
      symlinkSync(
        join(stagedProjectRoot, 'apps', 'brain-film'),
        join(scopedRoot, 'brain-film'),
        process.platform === 'win32' ? 'junction' : 'dir',
      )
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
      writeFileSync(destinationZip, 'zip')
    },
  })

  assert.equal(
    readFileSync(
      join(result.packageRoot, 'project', 'server', '.env.local'),
      'utf8',
    ),
    'SECRET_SERVER_FIXTURE',
  )
  assert.equal(
    readFileSync(
      join(result.packageRoot, 'project', 'apps', 'brain-film', '.env'),
      'utf8',
    ),
    'SECRET_FILM_FIXTURE',
  )
  assert.equal(JSON.stringify(result).includes('SECRET_SERVER_FIXTURE'), false)
  assert.equal(JSON.stringify(result).includes('SECRET_FILM_FIXTURE'), false)
  assert.equal(
    existsSync(join(result.packageRoot, 'project', 'node_modules', '@zhiya', 'brain-film')),
    false,
  )
  assert.equal(
    readFileSync(result.reportPath, 'utf8').includes('SECRET_SERVER_FIXTURE'),
    false,
  )
})
