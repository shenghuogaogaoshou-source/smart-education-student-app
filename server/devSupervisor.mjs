import { spawn as nodeSpawn } from 'node:child_process'

export function createDevSupervisor(specs, {
  spawnImpl = nodeSpawn,
  setTimer = setTimeout,
  restartDelayMs = 800,
  maxRestarts = 3,
  onFatal = (code) => { process.exitCode = code },
  logger = console,
} = {}) {
  const active = new Map()
  const restartCounts = new Map()
  let stopping = false

  function stop(exitCode = 0) {
    if (stopping) return
    stopping = true
    for (const child of active.values()) {
      if (child.exitCode === null && !child.killed) child.kill()
    }
    if (exitCode) onFatal(exitCode)
  }

  function launch(spec) {
    if (stopping) return null
    const child = spawnImpl(spec.command, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env },
      stdio: 'inherit',
    })
    child.processName = spec.name
    active.set(spec.name, child)

    const handleFailure = (code, reason) => {
      if (stopping || active.get(spec.name) !== child) return
      active.delete(spec.name)
      if (!spec.resilient) {
        logger.error(`[dev] ${spec.name} ${reason}`)
        stop(code || 1)
        return
      }
      const count = restartCounts.get(spec.name) ?? 0
      if (count >= maxRestarts) {
        logger.error(`[dev] ${spec.name} 连续启动失败，主应用继续运行；请检查本地配置。`)
        return
      }
      restartCounts.set(spec.name, count + 1)
      logger.warn(`[dev] ${spec.name} 暂时退出，正在独立恢复（${count + 1}/${maxRestarts}）。`)
      setTimer(() => launch(spec), restartDelayMs)
    }

    child.once('error', (error) => handleFailure(1, `启动失败: ${error.message}`))
    child.once('exit', (code) => handleFailure(code ?? 0, `已退出（${code ?? 0}）`))
    return child
  }

  for (const spec of specs) launch(spec)
  return { stop, active }
}
