import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createSourceZip } from './package-source-app.mjs'
import {
  copyFfmpegRuntime,
  copyNodeRuntime,
  copyPythonRuntime,
  resolveRuntimeSources,
  verifyPortableRuntime,
} from './portable-runtime.mjs'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT_ROOT = 'E:\\智芽\\源文件'
const FORBIDDEN_SEGMENTS = new Set(['node_modules', 'dist', '__pycache__', '.worktrees', '.git'])

export function completeManifest() {
  return [
    'src',
    'public',
    'server',
    'apps',
    'packages',
    'scripts',
    'docs',
    'templates',
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.server.config.ts',
    '.npmrc',
    '.gitignore',
    'LICENSE',
    'README.md',
    'server/.env.local',
    'apps/brain-film/.env',
  ]
}

export function forbiddenCompletePath(filePath) {
  const normalized = filePath.replaceAll('\\', '/')
  const parts = normalized.split('/')
  if (parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) return true
  if (/(^|\/)(dev-out\.txt|dev-err\.txt|server\.log|tsconfig\.tsbuildinfo)$/.test(normalized)) return true
  if (/\.(?:log|tsbuildinfo)$/i.test(normalized)) return true
  if (/\/data\/(?:bh\.db|films\/)/i.test(normalized)) return true
  return false
}

function copyFiltered(sourceRoot, destinationRoot, entry) {
  const source = join(sourceRoot, entry)
  if (!existsSync(source)) return
  const stat = statSync(source)
  if (stat.isDirectory()) {
    for (const child of readdirSync(source)) copyFiltered(sourceRoot, destinationRoot, join(entry, child))
    return
  }
  if (forbiddenCompletePath(entry)) return
  const destination = join(destinationRoot, entry)
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination)
}

function safeStage(outputRoot) {
  const stage = resolve(join(outputRoot, '.build-complete'))
  const root = resolve(outputRoot)
  if (!stage.startsWith(`${root}${sep}`)) throw new Error(`Unsafe staging path: ${stage}`)
  return stage
}

export function buildCompletePackage({
  outputRoot = DEFAULT_OUTPUT_ROOT,
  runtimeSources = resolveRuntimeSources(process.env),
} = {}) {
  const stageRoot = safeStage(outputRoot)
  const packageRoot = join(stageRoot, '智芽完整演示包')
  rmSync(stageRoot, { recursive: true, force: true })
  mkdirSync(packageRoot, { recursive: true })

  for (const entry of completeManifest()) copyFiltered(PROJECT_ROOT, packageRoot, entry)
  mkdirSync(join(packageRoot, 'apps', 'brain-film', 'data'), { recursive: true })
  writeFileSync(join(packageRoot, 'apps', 'brain-film', 'data', '.gitkeep'), '', 'utf8')
  cpSync(join(PROJECT_ROOT, 'templates', 'source-packages', 'complete', '启动.cmd'), join(packageRoot, '启动.cmd'))
  const launcherPath = join(packageRoot, '启动.cmd')
  writeFileSync(launcherPath, readFileSync(launcherPath, 'utf8').replace(/\r?\n/g, '\r\n'), 'utf8')
  cpSync(join(PROJECT_ROOT, 'templates', 'source-packages', 'complete', 'launcher'), join(packageRoot, 'launcher'), { recursive: true })
  cpSync(join(PROJECT_ROOT, 'templates', 'source-packages', 'complete', '启动说明.txt'), join(packageRoot, '启动说明.txt'))

  const runtimeRoot = join(packageRoot, 'runtime')
  copyNodeRuntime(runtimeSources.nodeRoot, join(runtimeRoot, 'node'))
  copyPythonRuntime(runtimeSources.pythonRoot, join(runtimeRoot, 'python'))
  copyFfmpegRuntime(runtimeSources.ffmpegBinRoot, join(runtimeRoot, 'ffmpeg'))
  const runtimeVerification = verifyPortableRuntime(runtimeRoot)

  const zipPath = join(outputRoot, '智芽完整演示包.zip')
  createSourceZip(packageRoot, zipPath)
  return { zipPath, packageRoot, stageRoot, runtimeVerification }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(buildCompletePackage(), null, 2))
}
