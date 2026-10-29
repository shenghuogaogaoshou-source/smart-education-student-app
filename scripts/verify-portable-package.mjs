import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HEALTH_ENDPOINTS = [
  'http://127.0.0.1:5173/',
  'http://127.0.0.1:5191/',
  'http://127.0.0.1:5192/',
  'http://127.0.0.1:8766/api/health',
  'http://127.0.0.1:8787/api/health',
]

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function pythonCommand() {
  return process.platform === 'win32'
    ? ['py', ['-3.12', '-c']]
    : ['python3', ['-c']]
}

function extractZip(zipPath, destination) {
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  const script = [
    'import pathlib, sys, zipfile',
    'target = pathlib.Path(sys.argv[2]).resolve()',
    'with zipfile.ZipFile(sys.argv[1]) as archive:',
    '    for member in archive.infolist():',
    '        name = pathlib.PurePosixPath(member.filename)',
    '        if name.is_absolute() or ".." in name.parts:',
    '            raise SystemExit("unsafe ZIP member: " + member.filename)',
    '    archive.extractall(target)',
  ].join('\n')
  const [command, baseArgs] = pythonCommand()
  const result = spawnSync(
    command,
    [...baseArgs, script, zipPath, destination],
    { encoding: 'utf8', windowsHide: true },
  )
  if (result.status !== 0) {
    throw new Error(`ZIP extraction failed: ${result.stderr || result.status}`)
  }
}

function findPackageRoot(extractionPath) {
  const candidates = readdirSync(extractionPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(extractionPath, entry.name))
  if (candidates.length !== 1) {
    throw new Error('Portable ZIP must contain exactly one package root directory')
  }
  return candidates[0]
}

function assertPackageFiles(packageRoot) {
  for (const relativePath of [
    '启动.cmd',
    'launcher/start.ps1',
    'runtime/node/node.exe',
    'runtime/python/python.exe',
    'runtime/ffmpeg/ffmpeg.exe',
    'runtime/ffmpeg/ffprobe.exe',
    'project/package.json',
    'project/node_modules/@zhiya/task-client',
    'project/node_modules/@zhiya/works-bridge',
  ]) {
    if (!existsSync(join(packageRoot, relativePath))) {
      throw new Error(`Portable package is incomplete: missing ${relativePath}`)
    }
  }
}

async function requestWithTimeout(
  fetchImpl,
  url,
  options = {},
  timeoutMs = 15_000,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForEndpoint(fetchImpl, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastStatus = 'unreachable'
  while (Date.now() < deadline) {
    try {
      const response = await requestWithTimeout(
        fetchImpl,
        url,
        { method: 'GET' },
        Math.min(3_000, Math.max(500, deadline - Date.now())),
      )
      lastStatus = response.status
      if (response.ok) return response
    } catch {
      lastStatus = 'unreachable'
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }
  throw new Error(`health endpoint did not become ready: ${url} (${lastStatus})`)
}

async function readJson(response, endpoint) {
  if (!response.ok) {
    throw new Error(`health endpoint returned ${response.status}: ${endpoint}`)
  }
  try {
    return await response.json()
  } catch {
    throw new Error(`health endpoint returned invalid JSON: ${endpoint}`)
  }
}

async function defaultLaunchPackage({ packageRoot, environment }) {
  if (process.platform !== 'win32') {
    throw new Error('The complete launcher can only be verified on Windows')
  }
  const child = spawn(
    'cmd.exe',
    ['/d', '/c', join(packageRoot, '启动.cmd')],
    {
      cwd: packageRoot,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  let stderr = ''
  child.stdout.resume()
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    if (stderr.length < 8_000) stderr += chunk
  })

  return {
    process: child,
    stop: async () => {
      const shutdownFile = environment.ZHIYA_VERIFY_SHUTDOWN_FILE
      if (shutdownFile) writeFileSync(shutdownFile, 'stop\n')
      if (child.exitCode === null) {
        await Promise.race([
          new Promise((resolveExit) => child.once('exit', resolveExit)),
          new Promise((resolveDelay) => setTimeout(resolveDelay, 15_000)),
        ])
      }
      if (child.exitCode === null) child.kill()
      if (child.exitCode !== 0 && child.exitCode !== null) {
        throw new Error(`Portable launcher exited with ${child.exitCode}: ${stderr}`)
      }
    },
  }
}

async function assertPortsReleased(fetchImpl) {
  for (const endpoint of HEALTH_ENDPOINTS) {
    try {
      await requestWithTimeout(
        fetchImpl,
        endpoint,
        { method: 'GET' },
        800,
      )
      throw new Error(`port was not released after shutdown: ${endpoint}`)
    } catch (error) {
      if (String(error?.message).startsWith('port was not released')) throw error
    }
  }
}

async function runLiveApiSmoke({ packageRoot, fetchImpl, timeoutMs }) {
  const results = {}
  const companionBase = 'http://127.0.0.1:8787'
  const brainBase = 'http://127.0.0.1:8766'

  const chatResponse = await requestWithTimeout(
    fetchImpl,
    `${companionBase}/api/deepseek/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: '请用一句适合小学生的短句，提醒我学习 AI 时要保护个人隐私。',
        }],
        temperature: 0.1,
        max_tokens: 512,
      }),
    },
    30_000,
  )
  const chat = await readJson(chatResponse, 'deepseek chat')
  if (!chat?.choices?.[0]?.message?.content) {
    throw new Error('live API smoke failed: empty DeepSeek reply')
  }
  results.chat = { status: chatResponse.status }

  const ttsResponse = await requestWithTimeout(
    fetchImpl,
    `${companionBase}/api/tts`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '你好，智芽。' }),
    },
    30_000,
  )
  if (!ttsResponse.ok) {
    throw new Error(`live API smoke failed: TTS returned ${ttsResponse.status}`)
  }
  const audio = Buffer.from(await ttsResponse.arrayBuffer())
  if (audio.length < 100) {
    throw new Error('live API smoke failed: empty TTS audio')
  }
  const contentType = ttsResponse.headers.get('content-type') || 'audio/wav'
  const transcribeResponse = await requestWithTimeout(
    fetchImpl,
    `${companionBase}/api/companion/transcribe`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        audio: `data:${contentType.split(';')[0]};base64,${audio.toString('base64')}`,
      }),
    },
    45_000,
  )
  const transcript = await readJson(transcribeResponse, 'transcribe')
  if (!transcript?.text) {
    throw new Error('live API smoke failed: empty transcription')
  }
  results.transcribe = { status: transcribeResponse.status }

  const imagePath = join(
    packageRoot,
    'project',
    'public',
    'demo-works',
    'images',
    'cloud-seed.webp',
  )
  if (!existsSync(imagePath)) {
    throw new Error('live API smoke failed: safe verification image is missing')
  }
  const recognizeResponse = await requestWithTimeout(
    fetchImpl,
    `${companionBase}/api/companion/recognize`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tool: 'object',
        image: `data:image/webp;base64,${readFileSync(imagePath).toString('base64')}`,
      }),
    },
    90_000,
  )
  const recognition = await readJson(recognizeResponse, 'recognize')
  if (!recognition?.result?.output) {
    throw new Error('live API smoke failed: empty recognition result')
  }
  results.recognize = { status: recognizeResponse.status }

  const configResponse = await requestWithTimeout(
    fetchImpl,
    `${brainBase}/api/config`,
    { method: 'GET' },
    15_000,
  )
  const config = await readJson(configResponse, 'brain config')
  results.brainConfig = {
    status: configResponse.status,
    aiEnabled: config?.ai === true,
    backendReady: config?.backend === true,
  }

  const createResponse = await requestWithTimeout(
    fetchImpl,
    `${companionBase}/api/tasks`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'film-image',
        clientTaskId: randomUUID(),
        payload: {
          prompt: '儿童绘本插画，一株刚发芽的小绿苗，明亮温暖，不出现文字',
        },
      }),
    },
    15_000,
  )
  const created = await readJson(createResponse, 'create creative task')
  if (!created?.taskId) {
    throw new Error('live API smoke failed: creative task ID is missing')
  }
  results.creativeTask = { status: createResponse.status }
  const deadline = Date.now() + Math.min(timeoutMs, 120_000)
  while (Date.now() < deadline) {
    const pollResponse = await requestWithTimeout(
      fetchImpl,
      `${companionBase}/api/tasks/${created.taskId}`,
      { method: 'GET' },
      15_000,
    )
    const task = await readJson(pollResponse, 'poll creative task')
    if (task.status === 'succeeded') {
      results.creativeTask.finalStatus = 'succeeded'
      return results
    }
    if (['failed', 'interrupted'].includes(task.status)) {
      throw new Error(
        `live API smoke failed: creative task ended as ${task.status}`,
      )
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000))
  }
  throw new Error('live API smoke failed: creative task timed out')
}

export async function verifyPortablePackage({
  zipPath,
  extractionRoot,
  liveApi = false,
  fetchImpl = fetch,
  launchPackage = defaultLaunchPackage,
  healthTimeoutMs = 75_000,
  liveApiTimeoutMs = 120_000,
  checkPortsReleased = true,
}) {
  const startedAt = Date.now()
  const zip = resolve(zipPath)
  if (!existsSync(zip) || !lstatSync(zip).isFile()) {
    throw new Error(`Portable ZIP does not exist: ${zip}`)
  }
  const extractBase = extractionRoot
    ? resolve(extractionRoot)
    : mkdtempSync(join(tmpdir(), 'zhiya-verify-'))
  const extractionPath = join(extractBase, '智芽 比赛验证')
  const reportPath = join(extractBase, 'verification-report.json')
  const shutdownFile = join(extractBase, 'shutdown.request')
  let launched
  let report

  try {
    extractZip(zip, extractionPath)
    const packageRoot = findPackageRoot(extractionPath)
    assertPackageFiles(packageRoot)
    const version = JSON.parse(
      readFileSync(join(packageRoot, 'project', 'package.json'), 'utf8'),
    ).version

    launched = await launchPackage({
      packageRoot,
      environment: {
        ZHIYA_NO_BROWSER: '1',
        ZHIYA_NONINTERACTIVE: '1',
        ZHIYA_VERIFY_SHUTDOWN_FILE: shutdownFile,
      },
    })

    const endpoints = {}
    for (const endpoint of HEALTH_ENDPOINTS) {
      const endpointStartedAt = Date.now()
      const response = await waitForEndpoint(
        fetchImpl,
        endpoint,
        healthTimeoutMs,
      )
      endpoints[endpoint] = {
        status: response.status,
        durationMs: Date.now() - endpointStartedAt,
      }
    }

    const page = await (
      await requestWithTimeout(
        fetchImpl,
        HEALTH_ENDPOINTS[0],
        { method: 'GET' },
        5_000,
      )
    ).text()
    if (!page.includes('id="root"')) {
      throw new Error('portable main page does not contain the app root')
    }
    await readJson(
      await requestWithTimeout(
        fetchImpl,
        HEALTH_ENDPOINTS[3],
        { method: 'GET' },
        5_000,
      ),
      HEALTH_ENDPOINTS[3],
    )
    await readJson(
      await requestWithTimeout(
        fetchImpl,
        HEALTH_ENDPOINTS[4],
        { method: 'GET' },
        5_000,
      ),
      HEALTH_ENDPOINTS[4],
    )

    const liveApiResults = liveApi
      ? await runLiveApiSmoke({
          packageRoot,
          fetchImpl,
          timeoutMs: liveApiTimeoutMs,
        })
      : undefined

    await launched.stop()
    launched = undefined
    if (checkPortsReleased) await assertPortsReleased(fetchImpl)

    report = {
      status: 'passed',
      version,
      durationMs: Date.now() - startedAt,
      size: lstatSync(zip).size,
      sha256: sha256File(zip),
      endpoints,
      liveApi: liveApiResults,
      reportPath,
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    return report
  } catch (error) {
    report = {
      status: 'failed',
      durationMs: Date.now() - startedAt,
      size: lstatSync(zip).size,
      sha256: sha256File(zip),
      error: error instanceof Error ? error.message : 'verification_failed',
      reportPath,
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    throw error
  } finally {
    if (launched) {
      try {
        await launched.stop()
      } catch {
        // The primary verification error remains more useful to the operator.
      }
    }
  }
}

function parseArgs(argv) {
  const args = { liveApi: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--live-api') {
      args.liveApi = true
      continue
    }
    if (arg === '--zip' || arg === '--extraction-root') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`)
      }
      args[arg === '--zip' ? 'zipPath' : 'extractionRoot'] = value
      index += 1
      continue
    }
    throw new Error(`Unknown verification option: ${arg}`)
  }
  if (!args.zipPath) throw new Error('--zip is required')
  return args
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await verifyPortablePackage(parseArgs(process.argv.slice(2)))
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    console.error(
      JSON.stringify({
        status: 'failed',
        error: error instanceof Error ? error.message : 'verification_failed',
      }),
    )
    process.exitCode = 1
  }
}
