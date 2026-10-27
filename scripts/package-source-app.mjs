import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT_ROOT = 'E:\\智芽\\源文件'
const FORBIDDEN_SEGMENTS = new Set(['node_modules', 'dist', '__pycache__', '.worktrees', '.git'])
const FORBIDDEN_FILES = new Set([
  'dev-out.txt',
  'dev-err.txt',
  'server.log',
  'tsconfig.tsbuildinfo',
  'apps/brain-film/package-lock.json',
  'apps/creative-module/package-lock.json',
  'apps/brain-film/vite.config.js',
  'apps/brain-film/vite.config.d.ts',
])

export function frontendManifest() {
  return [
    'src',
    'public',
    'packages/works-bridge',
    'apps/brain-film/src',
    'apps/brain-film/css',
    'apps/creative-module/src',
    'apps/creative-module/public',
    'apps/creative-module/tests',
    'scripts/build-embedded-games.mjs',
    'scripts/processCommand.mjs',
  ]
}

export function backendManifest() {
  return [
    'server/ai-proxy.mjs',
    'server/ai-proxy.test.mjs',
    'server/companionIntent.mjs',
    'server/companionIntent.test.mjs',
    'server/companionPolicy.mjs',
    'server/companionPolicy.test.mjs',
    'server/learningCatalog.mjs',
    'server/recognition.mjs',
    'server/recognition.test.mjs',
    'server/schedulePolicy.mjs',
    'server/tts.mjs',
    'server/tts.test.mjs',
    'apps/brain-film/server.py',
    'apps/brain-film/tests/test_http_layer.py',
    'apps/brain-film/tests/test_local_runtime.py',
    'apps/brain-film/tests/test_stitch.py',
  ]
}

export function forbiddenPackagePath(filePath) {
  const normalized = filePath.replaceAll('\\', '/')
  if (!normalized) return false
  const parts = normalized.split('/')
  if (parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) return true
  if (FORBIDDEN_FILES.has(normalized)) return true
  if (/\.(?:log|tsbuildinfo)$/i.test(normalized)) return true
  if (/(^|\/)\.env(?:\.|$)/i.test(normalized) && !/\.example$/i.test(normalized)) return true
  return false
}

function assertSafeStage(stageRoot, outputRoot) {
  const stage = resolve(stageRoot)
  const output = resolve(outputRoot)
  if (stage === output || !stage.startsWith(`${output}${sep}`)) {
    throw new Error(`Unsafe staging path: ${stage}`)
  }
  return stage
}

function assertRequiredSource(projectRoot, entry) {
  const source = join(projectRoot, entry)
  if (!existsSync(source)) throw new Error(`Missing source entry: ${source}`)
  return source
}

function copyFiltered(projectRoot, destinationRoot, entry) {
  const source = assertRequiredSource(projectRoot, entry)
  const stat = statSync(source)
  if (stat.isFile()) {
    if (!forbiddenPackagePath(entry)) {
      const destination = join(destinationRoot, entry)
      mkdirSync(dirname(destination), { recursive: true })
      cpSync(source, destination)
    }
    return
  }

  for (const child of readdirSync(source)) {
    const childPath = join(entry, child)
    if (!forbiddenPackagePath(childPath)) copyFiltered(projectRoot, destinationRoot, childPath)
  }
}

function copyFile(projectRoot, destinationRoot, entry, target = entry) {
  const source = assertRequiredSource(projectRoot, entry)
  const destination = join(destinationRoot, target)
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination)
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function patchFrontendGamePackages(destinationRoot) {
  const brainPackagePath = join(destinationRoot, 'apps', 'brain-film', 'package.json')
  const brainPackage = JSON.parse(readFileSync(brainPackagePath, 'utf8'))
  delete brainPackage.scripts?.test
  delete brainPackage.scripts?.['test:py']
  delete brainPackage.scripts?.['test:e2e']
  writeJson(brainPackagePath, brainPackage)
}

function createFrontendPackage(destinationRoot) {
  copyFile(PROJECT_ROOT, destinationRoot, 'index.html')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/tsconfig.json', 'tsconfig.json')
  copyFile(PROJECT_ROOT, destinationRoot, '.npmrc')
  copyFile(PROJECT_ROOT, destinationRoot, 'LICENSE')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/brain-film/index.html')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/brain-film/package.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/brain-film/tsconfig.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/apps-brain-film-vite.config.ts', 'apps/brain-film/vite.config.ts')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/brain-film/icon-192.png')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/creative-module/index.html')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/creative-module/package.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/creative-module/postcss.config.js')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/creative-module/tailwind.config.js')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/creative-module/tsconfig.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'apps/creative-module/tsconfig.node.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/apps-creative-module-vite.config.ts', 'apps/creative-module/vite.config.ts')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/package.json', 'package.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/vite.config.ts', 'vite.config.ts')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/dev-frontends.mjs', 'scripts/dev-frontends.mjs')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/frontend/README.md', 'README.md')
  patchFrontendGamePackages(destinationRoot)
}

function createBackendPackage(destinationRoot) {
  copyFile(PROJECT_ROOT, destinationRoot, 'LICENSE')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/backend/package.json', 'package.json')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/backend/start-all.mjs', 'start-all.mjs')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/backend/README.md', 'README.md')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/backend/server.env.local.example', 'server/.env.local.example')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/backend/brain-film.env.example', 'apps/brain-film/.env.example')
  copyFile(PROJECT_ROOT, destinationRoot, 'templates/source-packages/backend/health.test.mjs', 'tests/health.test.mjs')
  mkdirSync(join(destinationRoot, 'apps', 'brain-film', 'data'), { recursive: true })
  writeFileSync(join(destinationRoot, 'apps', 'brain-film', 'data', '.gitkeep'), '', 'utf8')
  writeFileSync(join(destinationRoot, '.gitignore'), 'node_modules/\n.env\n.env.*\n!.env.example\n!.env.local.example\ndata/*.db\ndata/*.log\ndata/films/\n__pycache__/\n', 'utf8')
}

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath
    || join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(npmCli)) throw new Error(`Cannot find npm CLI: ${npmCli}`)
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed with ${result.status}`)
}

export function stageSourcePackages({
  projectRoot = PROJECT_ROOT,
  outputRoot = DEFAULT_OUTPUT_ROOT,
} = {}) {
  const stageRoot = assertSafeStage(join(outputRoot, '.build'), outputRoot)
  const frontendRoot = join(stageRoot, '智芽App前端')
  const backendRoot = join(stageRoot, '智芽App后端')
  rmSync(stageRoot, { recursive: true, force: true })
  mkdirSync(frontendRoot, { recursive: true })
  mkdirSync(backendRoot, { recursive: true })

  for (const entry of frontendManifest()) copyFiltered(projectRoot, frontendRoot, entry)
  createFrontendPackage(frontendRoot)
  for (const entry of backendManifest()) copyFiltered(projectRoot, backendRoot, entry)
  createBackendPackage(backendRoot)

  return { frontendRoot, backendRoot, stageRoot }
}

export function createSourceZip(sourceDirectory, destinationZip) {
  if (process.platform !== 'win32') throw new Error('Source ZIP creation currently requires Windows PowerShell')
  mkdirSync(dirname(destinationZip), { recursive: true })
  rmSync(destinationZip, { force: true })
  const script = [
    'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
    `[System.IO.Compression.ZipFile]::CreateFromDirectory('${sourceDirectory.replaceAll("'", "''")}',`,
    `'${destinationZip.replaceAll("'", "''")}',`,
    '[System.IO.Compression.CompressionLevel]::Optimal, $true)',
  ].join(' ')
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`ZIP creation failed with ${result.status}`)
}

export function buildSourcePackages({ outputRoot = DEFAULT_OUTPUT_ROOT } = {}) {
  const { frontendRoot, backendRoot, stageRoot } = stageSourcePackages({ outputRoot })
  runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], frontendRoot)
  runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], backendRoot)

  const frontendZip = join(outputRoot, '智芽App前端.zip')
  const backendZip = join(outputRoot, '智芽App后端.zip')
  createSourceZip(frontendRoot, frontendZip)
  createSourceZip(backendRoot, backendZip)
  return { frontendZip, backendZip, frontendRoot, backendRoot, stageRoot }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = buildSourcePackages()
  console.log(JSON.stringify(result, null, 2))
}
