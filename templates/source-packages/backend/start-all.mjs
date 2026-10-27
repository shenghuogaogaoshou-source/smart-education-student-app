import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'

export function pythonCandidates(platform = process.platform) {
  return platform === 'win32'
    ? [
        { command: 'py', prefix: ['-3'] },
        { command: 'python', prefix: [] },
        { command: 'python3', prefix: [] },
      ]
    : [
        { command: 'python3', prefix: [] },
        { command: 'python', prefix: [] },
      ]
}

export function findPython(platform = process.platform) {
  for (const candidate of pythonCandidates(platform)) {
    const probe = spawnSync(candidate.command, [...candidate.prefix, '-c', 'import sys'], {
      stdio: 'ignore',
      shell: false,
    })
    if (!probe.error && probe.status === 0) return candidate
  }
  return null
}

export function buildServiceSpecs(root = process.cwd(), python = findPython()) {
  if (!python) throw new Error('未找到 Python 3，请先安装 Python 3.12 或更新版本。')
  return [
    {
      name: 'ai-proxy',
      cwd: root,
      command: process.execPath,
      args: [join(root, 'server', 'ai-proxy.mjs')],
    },
    {
      name: 'brain-film-api',
      cwd: join(root, 'apps', 'brain-film'),
      command: python.command,
      args: [...python.prefix, 'server.py', '--host', '127.0.0.1', '--port', '8766'],
      env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    },
  ]
}

function start() {
  const root = resolve(process.cwd())
  const children = []
  let stopping = false

  const stop = (code = 0) => {
    if (stopping) return
    stopping = true
    for (const child of children) {
      if (!child.killed) child.kill()
    }
    setTimeout(() => process.exit(code), 200)
  }

  for (const spec of buildServiceSpecs(root)) {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      stdio: 'inherit',
      env: { ...process.env, ...spec.env },
      shell: false,
    })
    children.push(child)
    child.on('exit', (code) => {
      if (!stopping) stop(code ?? 1)
    })
  }

  process.on('SIGINT', () => stop(0))
  process.on('SIGTERM', () => stop(0))
  console.log('智芽后端已启动：')
  console.log('  AI 伙伴与识别：http://127.0.0.1:8787/')
  console.log('  脑洞放映厅：http://127.0.0.1:8766/')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
