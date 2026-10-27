import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync,
} from 'node:fs'
import { networkInterfaces } from 'node:os'
import { basename, dirname, join, parse, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT_DIR = 'E:\\智芽\\运行文件'
const VIRTUAL_ADAPTER = /VMware|VirtualBox|vEthernet|Docker|Loopback|Hyper-V|WSL|Tailscale/i
const SIGNING_ENV = [
  'ZHIYA_ANDROID_KEYSTORE_PATH', 'ZHIYA_ANDROID_KEYSTORE_PASSWORD',
  'ZHIYA_ANDROID_KEY_ALIAS', 'ZHIYA_ANDROID_KEY_PASSWORD',
]

export function selectLanIPv4({ override = process.env.ZHIYA_ANDROID_BACKEND_HOST, interfaces = networkInterfaces() } = {}) {
  if (override?.trim()) return override.trim()
  const candidates = []
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (VIRTUAL_ADAPTER.test(name)) continue
    for (const address of addresses ?? []) {
      const isIPv4 = address.family === 'IPv4' || address.family === 4
      if (!address.internal && isIPv4 && /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address.address)) {
        candidates.push({ address: address.address, score: /Wi-?Fi|WLAN|无线/i.test(name) ? 2 : /Ethernet|以太网/i.test(name) ? 1 : 0 })
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score)
  return candidates[0]?.address ?? '10.0.2.2'
}

function findJdk21() {
  if (process.env.ZHIYA_ANDROID_JAVA_HOME) return process.env.ZHIYA_ANDROID_JAVA_HOME
  for (const root of ['C:\\Program Files\\Microsoft', 'E:\\java']) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) if (/^jdk-21/i.test(entry)) return join(root, entry)
  }
  return 'E:\\java\\jdk17'
}

function npmCli() {
  const candidate = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(candidate)) throw new Error(`Cannot find npm CLI: ${candidate}`)
  return candidate
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`)
}

const runBatch = (command, args, cwd, env) => run('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], cwd, env)

export function validateProductionOrigin(value) {
  let url
  try { url = new URL(String(value || '').trim()) } catch { throw new Error('ZHIYA_PRODUCTION_API_ORIGIN is invalid') }
  if (url.protocol !== 'https:') throw new Error('ZHIYA_PRODUCTION_API_ORIGIN must use HTTPS')
  if (url.username || url.password) throw new Error('Production API origin must not contain credentials')
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Production API origin must not contain a path, query or fragment')
  return url.origin
}

export function releaseGradleCommand() { return ['gradlew.bat', 'assembleRelease'] }
export function releaseApkPath(root = PROJECT_ROOT) {
  return join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
}

export function readReleaseSigning(env = process.env) {
  const missing = SIGNING_ENV.filter((name) => !String(env[name] || '').trim())
  if (missing.length) throw new Error(`Release signing is incomplete: ${missing.join(', ')}`)
  return {
    keystorePath: resolve(env.ZHIYA_ANDROID_KEYSTORE_PATH),
    keystorePassword: env.ZHIYA_ANDROID_KEYSTORE_PASSWORD,
    keyAlias: env.ZHIYA_ANDROID_KEY_ALIAS,
    keyPassword: env.ZHIYA_ANDROID_KEY_PASSWORD,
  }
}

function assertSafeDeliveryDirectory(outputDir) {
  const resolved = resolve(outputDir)
  if (resolved === parse(resolved).root || basename(resolved) !== '运行文件') throw new Error('Refusing to clear an unsafe APK delivery directory')
  return resolved
}

export function publishSingleApk(sourceApk, outputDir = DEFAULT_OUTPUT_DIR) {
  const source = resolve(sourceApk)
  const targetDir = assertSafeDeliveryDirectory(outputDir)
  if (!existsSync(source) || !statSync(source).isFile()) throw new Error(`Release APK not found: ${source}`)
  mkdirSync(targetDir, { recursive: true })
  for (const entry of readdirSync(targetDir)) rmSync(join(targetDir, entry), { recursive: true, force: true })
  const target = join(targetDir, '智芽.apk')
  const temporary = join(targetDir, '.zhiya-release.tmp.apk')
  copyFileSync(source, temporary)
  renameSync(temporary, target)
  const entries = readdirSync(targetDir)
  if (entries.length !== 1 || entries[0] !== '智芽.apk' || !statSync(target).isFile()) {
    throw new Error('APK delivery directory must contain exactly one file: 智芽.apk')
  }
  return target
}

function findApkSigner(env = process.env) {
  if (env.APKSIGNER_PATH && existsSync(env.APKSIGNER_PATH)) return env.APKSIGNER_PATH
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || 'E:\\Android\\Sdk'
  const buildTools = join(sdk, 'build-tools')
  if (!existsSync(buildTools)) throw new Error('Android build-tools directory not found for apksigner')
  for (const version of readdirSync(buildTools).sort().reverse()) {
    const candidate = join(buildTools, version, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner')
    if (existsSync(candidate)) return candidate
  }
  throw new Error('apksigner was not found in Android build-tools')
}

const FORBIDDEN_RELEASE_STRINGS = [
  /\bsk-[A-Za-z0-9_-]{12,}/, /\bark-[A-Za-z0-9-]{16,}/,
  /127\.0\.0\.1:(?:8787|8766)/,
  /(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d+\.\d+:(?:8787|8766)/,
]

export function findForbiddenReleaseStrings(paths) {
  const findings = []
  const inspect = (path) => {
    const stats = statSync(path)
    if (stats.isDirectory()) { for (const entry of readdirSync(path)) inspect(join(path, entry)); return }
    if (!stats.isFile()) return
    const content = readFileSync(path).toString('latin1')
    if (FORBIDDEN_RELEASE_STRINGS.some((pattern) => pattern.test(content))) findings.push(path)
  }
  for (const path of paths) inspect(path)
  return findings
}

function assertReleaseContentIsSafe(paths) {
  const findings = findForbiddenReleaseStrings(paths)
  if (findings.length) throw new Error(`Release contains a credential or local endpoint: ${findings.map((path) => basename(path)).join(', ')}`)
}

function baseBuildEnv(env, nativeRelease) {
  const result = {
    ...env, JAVA_HOME: findJdk21(),
    ANDROID_HOME: env.ANDROID_HOME || 'E:\\Android\\Sdk',
    ANDROID_SDK_ROOT: env.ANDROID_SDK_ROOT || 'E:\\Android\\Sdk',
    VITE_NATIVE_RELEASE: nativeRelease,
  }
  delete result.VITE_DEFAULT_AI_ORIGIN
  delete result.VITE_DEFAULT_BRAIN_ORIGIN
  return result
}

export function buildAndroid({ outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const env = baseBuildEnv(process.env, '0')
  run(process.execPath, [npmCli(), 'run', 'build'], PROJECT_ROOT, env)
  run(process.execPath, [join(PROJECT_ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], PROJECT_ROOT, env)
  runBatch('gradlew.bat', ['assembleDebug'], join(PROJECT_ROOT, 'android'), env)
  return { apk: publishSingleApk(join(PROJECT_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), outputDir) }
}

export function buildAndroidRelease({ outputDir = DEFAULT_OUTPUT_DIR, env = process.env } = {}) {
  const origin = validateProductionOrigin(env.ZHIYA_PRODUCTION_API_ORIGIN)
  const signing = readReleaseSigning(env)
  if (!existsSync(signing.keystorePath)) throw new Error('Release keystore file does not exist')
  const buildEnv = { ...baseBuildEnv(env, '1'), VITE_PRODUCTION_API_ORIGIN: origin }
  delete buildEnv.HTTPS_PROXY
  delete buildEnv.HTTP_PROXY
  run(process.execPath, [npmCli(), 'run', 'build'], PROJECT_ROOT, buildEnv)
  assertReleaseContentIsSafe([join(PROJECT_ROOT, 'dist')])
  run(process.execPath, [join(PROJECT_ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], PROJECT_ROOT, buildEnv)
  runBatch('gradlew.bat', ['lintRelease'], join(PROJECT_ROOT, 'android'), buildEnv)
  const [gradle, task] = releaseGradleCommand()
  runBatch(gradle, [task], join(PROJECT_ROOT, 'android'), buildEnv)
  const builtApk = releaseApkPath(PROJECT_ROOT)
  if (!existsSync(builtApk)) throw new Error(`Release build did not produce ${builtApk}`)
  runBatch(findApkSigner(buildEnv), ['verify', '--verbose', '--print-certs', builtApk], PROJECT_ROOT, buildEnv)
  assertReleaseContentIsSafe([builtApk])
  return { apk: publishSingleApk(builtApk, outputDir), apiOrigin: origin }
}

export function readAndroidDefaults(apkDirectory = DEFAULT_OUTPUT_DIR) {
  const apk = join(apkDirectory, '智芽.apk')
  if (!existsSync(apk)) throw new Error(`APK not found: ${apk}`)
  return { apk, size: readFileSync(apk).byteLength }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = process.argv[2] === 'release' ? buildAndroidRelease() : buildAndroid()
  console.log(JSON.stringify(result, null, 2))
}
