import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
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
const DEFAULT_OUTPUT_ROOT = 'E:\\智芽\\运行文件'
const CANDIDATE_DIRECTORY = '.portable-candidate'
const PACKAGE_DIRECTORY = '智芽-Web完整演示包'
const CANDIDATE_ZIP = `${PACKAGE_DIRECTORY}.candidate.zip`
const DELIVERY_CONFIG_PATHS = [
  'server/.env.local',
  'apps/brain-film/.env',
]
const FORBIDDEN_SEGMENTS = new Set([
  '.git',
  '.worktrees',
  '.superpowers',
  '.gradle',
  '.cxx',
  '__pycache__',
  'node_modules',
  'dist',
])

export function portableProjectManifest() {
  return [
    'android',
    'src',
    'public',
    'server',
    'apps',
    'packages',
    'scripts',
    'docs',
    'templates',
    '.github',
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.server.config.ts',
    'capacitor.config.ts',
    '.npmrc',
    '.gitignore',
    '.dockerignore',
    'LICENSE',
    'README.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
  ]
}

export function forbiddenPortablePath(filePath) {
  const normalized = filePath.replaceAll('\\', '/')
  if (!normalized) return false
  const parts = normalized.split('/')
  if (parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) return true
  if (/^android\/(?:build|app\/build|capacitor-cordova-android-plugins\/build)(?:\/|$)/i.test(normalized)) {
    return true
  }
  if (/\.(?:apk|aab|jks|keystore|log|tsbuildinfo|pyc)$/i.test(normalized)) {
    return true
  }
  if (/(^|\/)\.env(?:\.|$)/i.test(normalized) && !/\.example$/i.test(normalized)) {
    return true
  }
  if (/(^|\/)(?:dev-out\.txt|dev-err\.txt|server\.log)$/i.test(normalized)) {
    return true
  }
  if (/\/data\/(?:bh\.db|films\/)/i.test(normalized)) return true
  return false
}

function assertSafeCandidateRoot(outputRoot, candidateRoot) {
  const output = resolve(outputRoot)
  const candidate = resolve(candidateRoot)
  if (!candidate.toLocaleLowerCase().startsWith(
    `${output.toLocaleLowerCase()}${sep}`,
  )) {
    throw new Error(`Unsafe portable staging path: ${candidate}`)
  }
  return candidate
}

function copyFiltered(sourceRoot, destinationRoot, entry) {
  const source = join(sourceRoot, entry)
  if (!existsSync(source)) return
  const stat = lstatSync(source)
  if (stat.isSymbolicLink()) {
    throw new Error(`Project source contains a symbolic link: ${source}`)
  }
  if (forbiddenPortablePath(entry)) return
  if (stat.isDirectory()) {
    for (const child of readdirSync(source)) {
      copyFiltered(
        sourceRoot,
        destinationRoot,
        join(entry, child),
      )
    }
    return
  }
  const destination = join(destinationRoot, entry)
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination)
}

function writeTextFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf8')
}

function copyLauncher(packageRoot) {
  const templateRoot = join(
    PROJECT_ROOT,
    'templates',
    'source-packages',
    'complete',
  )
  cpSync(
    join(templateRoot, '启动.cmd'),
    join(packageRoot, '启动.cmd'),
  )
  cpSync(join(templateRoot, 'launcher'), join(packageRoot, 'launcher'), {
    recursive: true,
  })
  cpSync(
    join(templateRoot, '启动说明.txt'),
    join(packageRoot, '启动说明.txt'),
  )
}

function assertCoreProjectFiles(projectRoot) {
  for (const requiredPath of [
    'src',
    'public',
    'server',
    'apps',
    'packages',
    'package.json',
    'package-lock.json',
  ]) {
    if (!existsSync(join(projectRoot, requiredPath))) {
      throw new Error(`Required project source is missing: ${requiredPath}`)
    }
  }
}

export function loadDeliveryConfig(projectRoot = PROJECT_ROOT) {
  const config = {}
  for (const relativePath of DELIVERY_CONFIG_PATHS) {
    const source = join(projectRoot, relativePath)
    if (!existsSync(source)) {
      throw new Error(`Delivery configuration is missing: ${relativePath}`)
    }
    const ignored = spawnSync(
      'git',
      ['check-ignore', '-q', '--', relativePath],
      {
        cwd: projectRoot,
        shell: false,
        windowsHide: true,
      },
    )
    if (ignored.status !== 0) {
      throw new Error(`Delivery configuration must be Git-ignored: ${relativePath}`)
    }
    config[relativePath] = readFileSync(source, 'utf8')
  }
  return config
}

function injectDeliveryConfig(stagedProjectRoot, deliveryConfig) {
  const entries = Object.entries(deliveryConfig ?? {})
  for (const [relativePath, value] of entries) {
    if (!DELIVERY_CONFIG_PATHS.includes(relativePath)) {
      throw new Error(`Unexpected delivery configuration path: ${relativePath}`)
    }
    if (typeof value !== 'string') {
      throw new Error(`Delivery configuration must be text: ${relativePath}`)
    }
    writeTextFile(join(stagedProjectRoot, relativePath), value)
  }
}

function runNpm(args, cwd) {
  const npmCli =
    process.env.npm_execpath ||
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(npmCli)) {
    throw new Error(`Cannot find npm CLI: ${npmCli}`)
  }
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with ${result.status}`)
  }
}

async function installDependencies(stagedProjectRoot) {
  runNpm(['ci', '--no-audit', '--no-fund'], stagedProjectRoot)
}

function verifyStagedWorkspace(stagedProjectRoot) {
  for (const packageName of ['task-client', 'works-bridge']) {
    const packageRoot = join(
      stagedProjectRoot,
      'node_modules',
      '@zhiya',
      packageName,
    )
    if (!existsSync(packageRoot)) {
      throw new Error(`Staged workspace package is missing: @zhiya/${packageName}`)
    }
  }
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

export async function buildCompletePackage({
  projectRoot = PROJECT_ROOT,
  outputRoot = DEFAULT_OUTPUT_ROOT,
  runtimeSources = resolveRuntimeSources(process.env),
  deliveryConfig = loadDeliveryConfig(projectRoot),
  keepStage = false,
  installDependencies: installDependenciesHook = installDependencies,
  verifyRuntime = verifyPortableRuntime,
  zipBuilder = createSourceZip,
} = {}) {
  const sourceRoot = resolve(projectRoot)
  const output = resolve(outputRoot)
  const candidateRoot = join(output, CANDIDATE_DIRECTORY)
  assertSafeCandidateRoot(output, candidateRoot)
  assertCoreProjectFiles(sourceRoot)

  const stageRoot = join(candidateRoot, 'stage')
  const packageRoot = join(stageRoot, PACKAGE_DIRECTORY)
  const stagedProjectRoot = join(packageRoot, 'project')
  const runtimeRoot = join(packageRoot, 'runtime')
  const candidateZip = join(candidateRoot, CANDIDATE_ZIP)
  const reportPath = join(candidateRoot, 'verification.json')

  rmSync(candidateRoot, { recursive: true, force: true })
  mkdirSync(stagedProjectRoot, { recursive: true })
  mkdirSync(runtimeRoot, { recursive: true })

  for (const entry of portableProjectManifest()) {
    copyFiltered(sourceRoot, stagedProjectRoot, entry)
  }
  mkdirSync(join(stagedProjectRoot, 'apps', 'brain-film', 'data'), {
    recursive: true,
  })
  writeTextFile(
    join(stagedProjectRoot, 'apps', 'brain-film', 'data', '.gitkeep'),
    '',
  )

  copyLauncher(packageRoot)
  copyNodeRuntime(runtimeSources.nodeRoot, join(runtimeRoot, 'node'))
  copyPythonRuntime(runtimeSources.pythonRoot, join(runtimeRoot, 'python'))
  copyFfmpegRuntime(runtimeSources.ffmpegBinRoot, join(runtimeRoot, 'ffmpeg'))
  const runtimeVerification = verifyRuntime(runtimeRoot)

  await installDependenciesHook(stagedProjectRoot)
  verifyStagedWorkspace(stagedProjectRoot)
  injectDeliveryConfig(stagedProjectRoot, deliveryConfig)

  const demoDataRoot = join(packageRoot, 'data')
  mkdirSync(demoDataRoot, { recursive: true })
  writeTextFile(
    join(demoDataRoot, 'README.txt'),
    '统一比赛演示数据由应用首次启动时幂等初始化。\n',
  )

  await zipBuilder(packageRoot, candidateZip)
  if (!existsSync(candidateZip)) {
    throw new Error(`ZIP builder did not create ${candidateZip}`)
  }

  const result = {
    zipPath: candidateZip,
    stageRoot,
    packageRoot,
    sha256: sha256File(candidateZip),
    runtimeVersions: runtimeVerification.versions,
    reportPath,
  }
  writeTextFile(
    reportPath,
    `${JSON.stringify(
      {
        status: 'candidate',
        sha256: result.sha256,
        size: lstatSync(candidateZip).size,
        runtimeVersions: result.runtimeVersions,
        verificationScript: 'node scripts/verify-portable-package.mjs --zip <candidate.zip>',
      },
      null,
      2,
    )}\n`,
  )

  if (!keepStage) {
    rmSync(stageRoot, { recursive: true, force: true })
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildCompletePackage()
  console.log(JSON.stringify(result, null, 2))
}
