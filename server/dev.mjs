import { spawn } from 'node:child_process'
import { buildDevProcessSpecs } from './devProcesses.mjs'

const root = process.cwd()
const forwardedArgs = process.argv.slice(2)
const specs = buildDevProcessSpecs(root, forwardedArgs)

const children = specs.map((spec) => {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    stdio: 'inherit',
  })
  child.processName = spec.name
  return child
})

let stopping = false

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill()
  }
  process.exitCode = exitCode
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`[dev] ${child.processName} 启动失败: ${error.message}`)
    if (child.processName !== 'ai-proxy') stop(1)
  })

  child.on('exit', (code) => {
    if (child.processName !== 'ai-proxy') {
      stop(code ?? 0)
    }
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
