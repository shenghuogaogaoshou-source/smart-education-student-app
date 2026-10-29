import {
  existsSync,
  lstatSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const STATIC_TARGETS = new Map([
  ['.data', '本地运行时数据，启动后可再生'],
  ['dist', '主应用构建产物，可由 npm run build 重新生成'],
  ['tsconfig.tsbuildinfo', 'TypeScript 增量构建缓存，可重新生成'],
  ['android/.gradle', 'Android Gradle 缓存，可重新下载和生成'],
  ['android/build', 'Android 根构建产物，可由 Gradle 重新生成'],
  ['android/app/build', 'Android 应用构建产物，可由 Gradle 重新生成'],
  ['android/app/.cxx', 'Android 原生构建缓存，可由 Gradle 重新生成'],
  [
    'android/capacitor-cordova-android-plugins/build',
    'Capacitor Android 插件构建产物，可由 Gradle 重新生成',
  ],
])

const APP_GENERATED_PATHS = new Map([
  ['dist', '应用构建产物，可重新生成'],
  ['__pycache__', 'Python 字节码缓存，可重新生成'],
  ['tests/__pycache__', 'Python 测试字节码缓存，可重新生成'],
  ['data/__pycache__', 'Python 数据模块字节码缓存，可重新生成'],
])

function portablePath(filePath) {
  return filePath.replaceAll('\\', '/')
}

function isWithinProject(projectRoot, targetPath) {
  const root = resolve(projectRoot)
  const target = resolve(targetPath)
  return target.toLocaleLowerCase().startsWith(
    `${root.toLocaleLowerCase()}${sep}`,
  )
}

function isAllowedCleanupPath(relativePath) {
  if (STATIC_TARGETS.has(relativePath)) return true
  if (/^[^/]+-(?:out|err)\.txt$/.test(relativePath)) return true

  const appMatch = relativePath.match(/^apps\/([^/]+)\/(.+)$/)
  if (appMatch) return APP_GENERATED_PATHS.has(appMatch[2])

  return false
}

function assertNoSymlinkTraversal(projectRoot, targetPath) {
  const root = resolve(projectRoot)
  const target = resolve(targetPath)
  const relativeParts = relative(root, target).split(sep)
  let current = root

  for (let index = 0; index < relativeParts.length; index += 1) {
    current = join(current, relativeParts[index])
    if (!existsSync(current)) break
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing to traverse symbolic link: ${current}`)
    }
  }
}

export function assertSafeCleanupTarget(projectRoot, targetPath) {
  const root = resolve(projectRoot)
  const target = resolve(targetPath)

  if (target === root || !isWithinProject(root, target)) {
    throw new Error(`Unsafe cleanup target outside project: ${target}`)
  }

  const relativePath = portablePath(relative(root, target))
  if (!isAllowedCleanupPath(relativePath)) {
    throw new Error(`Cleanup target is not in the safe allowlist: ${relativePath}`)
  }

  assertNoSymlinkTraversal(root, target)
  return target
}

function addTarget(entries, projectRoot, relativePath, reason) {
  const target = join(projectRoot, ...relativePath.split('/'))
  if (!existsSync(target)) return
  assertSafeCleanupTarget(projectRoot, target)
  entries.push({ path: portablePath(relativePath), reason, kind: 'generated' })
}

export function buildCleanupPlan(projectRoot = PROJECT_ROOT) {
  const root = resolve(projectRoot)
  const entries = []

  for (const [relativePath, reason] of STATIC_TARGETS) {
    addTarget(entries, root, relativePath, reason)
  }

  const appsRoot = join(root, 'apps')
  if (existsSync(appsRoot) && statSync(appsRoot).isDirectory()) {
    for (const app of readdirSync(appsRoot, { withFileTypes: true })) {
      if (!app.isDirectory()) continue
      for (const [relativePath, reason] of APP_GENERATED_PATHS) {
        addTarget(entries, root, `apps/${app.name}/${relativePath}`, reason)
      }
    }
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      /^[^/]+-(?:out|err)\.txt$/.test(entry.name)
    ) {
      addTarget(entries, root, entry.name, '根目录临时命令日志，可安全重新生成')
    }
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

export function applyCleanupPlan(projectRoot, entries) {
  const root = resolve(projectRoot)
  for (const entry of entries) {
    const target = assertSafeCleanupTarget(root, join(root, entry.path))
    rmSync(target, { recursive: true })
  }
}

export function printCleanupPlan(entries) {
  if (entries.length === 0) {
    console.log('没有发现可安全清理的生成物。')
    return
  }

  console.log(`发现 ${entries.length} 个可安全清理的生成物：`)
  for (const entry of entries) {
    console.log(`- ${entry.path}: ${entry.reason}`)
  }
}

function runCli() {
  const knownFlags = new Set(['--dry-run', '--apply'])
  const unknownFlags = process.argv.slice(2).filter((arg) => !knownFlags.has(arg))
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown cleanup option: ${unknownFlags.join(', ')}`)
  }

  const apply = process.argv.includes('--apply')
  const plan = buildCleanupPlan(PROJECT_ROOT)
  printCleanupPlan(plan)
  if (apply) {
    applyCleanupPlan(PROJECT_ROOT, plan)
    console.log(`已清理 ${plan.length} 个生成物。`)
  } else {
    console.log('当前为 dry-run，未修改磁盘。使用 --apply 执行清理。')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}
