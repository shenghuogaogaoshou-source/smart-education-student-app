export type TaskKind = 'vision' | 'product-image' | 'film-image'
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted'

export type TaskView = {
  taskId: string
  kind: TaskKind
  status: TaskStatus
  stage?: string
  createdAt: string
  updatedAt: string
  elapsedMs: number
  result?: unknown
  error?: string
}

export type TaskRequestOptions = {
  fetcher?: typeof fetch
  signal?: AbortSignal
  retryDelayMs?: number
}

export type PollOptions = TaskRequestOptions & {
  now?: () => number
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
}

export class TaskClientError extends Error {
  readonly status?: number
  readonly code: string

  constructor(status: number | undefined, code: string) {
    super(code)
    this.name = 'TaskClientError'
    this.status = status
    this.code = code
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

function taskError(status: number, body: unknown) {
  const code = body && typeof body === 'object' && typeof body.error === 'string'
    ? body.error.replace(/[^a-z0-9_-]/gi, '_').slice(0, 64)
    : 'task_request_failed'
  return new TaskClientError(status, code)
}

async function requestTask(
  input: string,
  init: RequestInit,
  options: TaskRequestOptions,
): Promise<TaskView> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const fetcher = options.fetcher ?? fetch
  let response: Response | undefined
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetcher(input, { ...init, signal: options.signal })
    if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === 1) break
    await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 250))
  }
  let body: unknown = null
  try {
    body = await response!.json()
  } catch {
    throw taskError(response!.status, null)
  }
  if (!response!.ok) throw taskError(response!.status, body)
  if (!body || typeof body !== 'object' || !('taskId' in body)) throw taskError(response!.status, null)
  return body as TaskView
}

export async function createTask(
  input: { kind: TaskKind; payload: unknown; clientTaskId: string },
  options: TaskRequestOptions = {},
): Promise<TaskView> {
  return requestTask('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }, options)
}

export function getTask(taskId: string, options: TaskRequestOptions = {}): Promise<TaskView> {
  return requestTask(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'GET' }, options)
}

function waitForVisible(options: PollOptions, delayMs: number, signal?: AbortSignal) {
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let settled = false
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || settled) return
      document.removeEventListener('visibilitychange', onVisibility)
      timer = setTimeoutImpl(resolve, delayMs) as ReturnType<typeof setTimeout>
    }
    const onAbort = () => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeoutImpl(timer)
      document?.removeEventListener('visibilitychange', onVisibility)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', onVisibility)
      return
    }
    timer = setTimeoutImpl(resolve, delayMs) as ReturnType<typeof setTimeout>
  })
}

export async function pollTask(taskId: string, options: PollOptions = {}): Promise<TaskView> {
  const startedAt = (options.now ?? Date.now)()
  while (true) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const task = await getTask(taskId, options)
    if (['succeeded', 'failed', 'interrupted'].includes(task.status)) return task
    const elapsed = (options.now ?? Date.now)() - startedAt
    await waitForVisible(options, elapsed < 10_000 ? 1_000 : 2_500, options.signal)
  }
}
