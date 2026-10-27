import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT_DIR = 'E:\\智芽\\运行文件'
const VIRTUAL_ADAPTER = /VMware|VirtualBox|vEthernet|Docker|Loopback|Hyper-V|WSL|Tailscale/i

export function selectLanIPv4({
  override = process.env.ZHIYA_ANDROID_BACKEND_HOST,
  interfaces = networkInterfaces(),
} = {}) {
  if (override?.trim()) return override.trim()
  const candidates = []
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (VIRTUAL_ADAPTER.test(name)) continue
    for (const address of addresses ?? []) {
      const isIPv4 = address.family === 'IPv4' || address.family === 4
      if (!address.internal && isIPv4 && /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address.address)) {
        const score = /Wi-?Fi|WLAN|无线/i.test(name) ? 2 : /Ethernet|以太网/i.test(name) ? 1 : 0
        candidates.push({ address: address.address, score })
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
    for (const entry of readdirSync(root)) {
      if (/^jdk-21/i.test(entry)) return join(root, entry)
    }
  }
  return 'E:\\java\\jdk17'
}

function npmCli() {
  const candidate = process.env.npm_execpath
    || join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(candidate)) throw new Error(`Cannot find npm CLI: ${candidate}`)
  return candidate
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`)
}

export function buildAndroid({ outputDir = DEFAULT_OUTPUT_DIR, host = selectLanIPv4() } = {}) {
  const aiOrigin = process.env.VITE_DEFAULT_AI_ORIGIN || `http://${host}:8787`
  const brainOrigin = process.env.VITE_DEFAULT_BRAIN_ORIGIN || `http://${host}:8766`
  const env = {
    ...process.env,
    JAVA_HOME: findJdk21(),
    ANDROID_HOME: process.env.ANDROID_HOME || 'E:\\Android\\Sdk',
    ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || 'E:\\Android\\Sdk',
    VITE_DEFAULT_AI_ORIGIN: aiOrigin,
    VITE_DEFAULT_BRAIN_ORIGIN: brainOrigin,
  }

  run(process.execPath, [npmCli(), 'run', 'build'], PROJECT_ROOT, env)
  run(
    process.execPath,
    [join(PROJECT_ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'],
    PROJECT_ROOT,
    env,
  )
  run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug'], join(PROJECT_ROOT, 'android'), env)

  const builtApk = join(PROJECT_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  if (!existsSync(builtApk)) throw new Error(`Android build did not produce ${builtApk}`)
  mkdirSync(outputDir, { recursive: true })
  const outputApk = join(outputDir, '智芽.apk')
  copyFileSync(builtApk, outputApk)
  return { apk: outputApk, aiOrigin, brainOrigin }
}

export function readAndroidDefaults(apkDirectory = DEFAULT_OUTPUT_DIR) {
  const apk = join(apkDirectory, '智芽.apk')
  if (!existsSync(apk)) throw new Error(`APK not found: ${apk}`)
  return { apk, size: readFileSync(apk).byteLength }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(buildAndroid(), null, 2))
}
