import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync } from 'node:fs'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const TASK_KINDS = new Set(['vision', 'product-image', 'film-image'])
const TASK_FILE = /^[0-9a-f-]{36}\.json$/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function createTaskService({
  dataDir,
  execute,
  maxConcurrent = 4,
  ttlMs = 86_400_000,
  maxTasks = 100,
  now = () => new Date(),
  randomId = randomUUID,
} = {}) {
  if (!dataDir || typeof execute !== 'function') throw new Error('invalid_task_service_config')
  const tasks = new Map()
  const pending = []
  const controllers = new Set()
  const runPromises = new Set()
  let active = 0
  let closed = false
  let started = false

  function publicView(task) {
    const view = {
      taskId: task.taskId,
      kind: task.kind,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      elapsedMs: Math.max(0, now().getTime() - Date.parse(task.createdAt)),
    }
    if (task.stage) view.stage = task.stage
    if (task.result !== undefined) view.result = task.result
    if (task.error) view.error = task.error
    return view
  }

  async function persist(task) {
    const target = join(dataDir, `${task.taskId}.json`)
    const temporary = `${target}.tmp`
    await writeFile(temporary, JSON.stringify(task), { mode: 0o600 })
    await rename(temporary, target)
  }

  function errorCode(error, signal) {
    if (signal.aborted) return 'task_interrupted'
    const value = error instanceof Error ? error.message : 'task_failed'
    return value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64) || 'task_failed'
  }

  async function run(task) {
    const controller = new AbortController()
    controllers.add(controller)
    task.status = 'running'
    task.stage = 'preparing'
    task.updatedAt = now().toISOString()
    await persist(task)

    try {
      task.result = await execute({
        kind: task.kind,
        payload: task.payload,
        signal: controller.signal,
        updateStage: async (stage) => {
          if (controller.signal.aborted) return
          task.stage = String(stage).slice(0, 40)
          task.updatedAt = now().toISOString()
          await persist(task)
        },
      })
      task.status = 'succeeded'
      delete task.stage
      delete task.error
    } catch (error) {
      task.status = controller.signal.aborted ? 'interrupted' : 'failed'
      task.error = errorCode(error, controller.signal)
      delete task.stage
    } finally {
      task.updatedAt = now().toISOString()
      await persist(task)
      controllers.delete(controller)
      active -= 1
      pump()
    }
  }

  function pump() {
    while (!closed && active < maxConcurrent && pending.length) {
      const task = pending.shift()
      active += 1
      const running = run(task).finally(() => runPromises.delete(running))
      runPromises.add(running)
    }
  }

  async function prune() {
    const ordered = [...tasks.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    for (const [index, task] of ordered.entries()) {
      const expired = now().getTime() - Date.parse(task.createdAt) > ttlMs
      if (index < maxTasks && !expired) continue
      tasks.delete(task.taskId)
      await unlink(join(dataDir, `${task.taskId}.json`)).catch(() => undefined)
    }
  }

  return {
    async start() {
      if (started) return
      started = true
      closed = false
      mkdirSync(dataDir, { recursive: true })
      const files = readdirSync(dataDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && TASK_FILE.test(entry.name))
        .map((entry) => join(dataDir, entry.name))

      for (const file of files) {
        try {
          const task = JSON.parse(await readFile(file, 'utf8'))
          if (!task?.taskId || !TASK_KINDS.has(task.kind)) continue
          if (task.status === 'queued' || task.status === 'running') {
            task.status = 'interrupted'
            task.error = 'task_interrupted'
            task.updatedAt = now().toISOString()
            await persist(task)
          }
          tasks.set(task.taskId, task)
        } catch {
          await unlink(file).catch(() => undefined)
        }
      }
      await prune()
    },

    async create(input) {
      if (!started || closed) throw new Error('service_unavailable')
      const kind = input?.kind
      const payload = input?.payload
      const clientTaskId = typeof input?.clientTaskId === 'string' ? input.clientTaskId.trim() : ''
      if (!TASK_KINDS.has(kind) || !isRecord(payload) || !clientTaskId || clientTaskId.length > 120) {
        throw new Error('invalid_input')
      }

      const existing = [...tasks.values()].find((task) => task.clientTaskId === clientTaskId)
      if (existing) return publicView(existing)

      const timestamp = now().toISOString()
      const task = {
        taskId: randomId(),
        kind,
        payload,
        clientTaskId,
        status: 'queued',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      tasks.set(task.taskId, task)
      await persist(task)
      await prune()
      const queued = publicView(task)
      pending.push(task)
      pump()
      return queued
    },

    get(taskId) {
      const task = tasks.get(taskId)
      return task ? publicView(task) : null
    },

    async close() {
      closed = true
      pending.length = 0
      for (const controller of controllers) controller.abort()
      await Promise.allSettled([...runPromises])
    },
  }
}
