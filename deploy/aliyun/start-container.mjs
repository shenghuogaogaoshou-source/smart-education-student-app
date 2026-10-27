import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')

export function buildChildSpecs(rootDir = projectRoot, baseEnv = process.env) {
  const sharedEnv = { ...baseEnv }
  return [
    {
      name: 'brain-film',
      command: baseEnv.PYTHON_COMMAND || 'python3',
      args: [
        '-u',
        join(rootDir, 'apps', 'brain-film', 'server.py'),
        '--host',
        '127.0.0.1',
        '--port',
        '8766',
      ],
      env: {
        ...sharedEnv,
        PYTHONUTF8: '1',
        PYTHONUNBUFFERED: '1',
        DATA_DIR: baseEnv.DATA_DIR || '/data',
      },
    },
    {
      name: 'cloud-gateway',
      command: process.execPath,
      args: [join(rootDir, 'server', 'cloudGateway.mjs')],
      env: {
        ...sharedEnv,
        HOST: '0.0.0.0',
        PORT: '8080',
        BRAIN_INTERNAL_ORIGIN: 'http://127.0.0.1:8766',
      },
    },
  ]
}

export async function waitForHealth(url, { timeoutMs = 30_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) })
      if (response.ok) return
    } catch {
      // The Python service is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs))
  }
  throw new Error(`health_check_timeout:${url}`)
}

function attachOutput(child, name, logStream) {
  for (const [stream, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream?.on('data', (chunk) => {
      target.write(chunk)
      logStream.write(`[${name}] ${chunk}`)
    })
  }
}

function spawnChild(spec, logStream) {
  const child = spawn(spec.command, spec.args, {
    cwd: projectRoot,
    env: spec.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  attachOutput(child, spec.name, logStream)
  return child
}

function terminateChildren(children, signal = 'SIGTERM') {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal)
  }
}

export async function runContainer() {
  const dataDir = process.env.DATA_DIR || '/data'
  mkdirSync(dataDir, { recursive: true })
  const logStream = createWriteStream(join(dataDir, 'runtime.log'), { flags: 'a' })
  const [pythonSpec, gatewaySpec] = buildChildSpecs()
  const children = []
  let stopping = false

  const stop = (signal = 'SIGTERM') => {
    if (stopping) return
    stopping = true
    terminateChildren(children, signal)
  }
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))

  const python = spawnChild(pythonSpec, logStream)
  children.push(python)
  const pythonExited = new Promise((resolveExit) => python.once('exit', (code, signal) => resolveExit({ code, signal })))

  try {
    const startup = await Promise.race([
      waitForHealth('http://127.0.0.1:8766/api/health').then(() => ({ ready: true })),
      pythonExited.then(({ code, signal }) => ({ ready: false, code, signal })),
    ])
    if (!startup.ready) throw new Error(`brain_service_exited:${startup.code ?? startup.signal ?? 'unknown'}`)

    const gateway = spawnChild(gatewaySpec, logStream)
    children.push(gateway)
    const gatewayExited = new Promise((resolveExit) => gateway.once('exit', (code, signal) => resolveExit({ code, signal })))
    const firstExit = await Promise.race([
      pythonExited.then((result) => ({ name: pythonSpec.name, ...result })),
      gatewayExited.then((result) => ({ name: gatewaySpec.name, ...result })),
    ])
    if (!stopping) {
      process.stderr.write(`${firstExit.name} exited unexpectedly\n`)
      process.exitCode = firstExit.code || 1
      stop('SIGTERM')
    }
    await Promise.allSettled([pythonExited, gatewayExited])
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'container_start_failed'}\n`)
    process.exitCode = 1
    stop('SIGTERM')
  } finally {
    logStream.end()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await runContainer()
}
