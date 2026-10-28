import { resolveApiUrl, type ApiService } from './mobileApi'

export type ApiRequestOptions = {
  attempts?: 1 | 2
  timeoutMs?: number
  retryDelayMs?: number
  requestId?: string
  fetcher?: typeof fetch
  service?: ApiService
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

function makeRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `zhiya-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function attemptSignal(callerSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timedOut = false

  const forwardAbort = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) forwardAbort()
  else callerSignal?.addEventListener('abort', forwardAbort, { once: true })

  const timer = timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
    }, timeoutMs)
    : null

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      if (timer !== null) clearTimeout(timer)
      callerSignal?.removeEventListener('abort', forwardAbort)
    },
  }
}

export async function requestWithRetry(
  input: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
) {
  const attempts = options.attempts ?? 1
  const requestId = options.requestId ?? makeRequestId()
  const fetcher = options.fetcher ?? fetch
  const callerSignal = init.signal

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (callerSignal?.aborted) throw callerSignal.reason ?? new DOMException('Aborted', 'AbortError')
    const timeout = attemptSignal(callerSignal, options.timeoutMs ?? 45_000)

    try {
      const headers = new Headers(init.headers)
      headers.set('x-zhiya-request-id', requestId)
      const response = await fetcher(resolveApiUrl(input, options.service), {
        ...init,
        headers,
        signal: timeout.signal,
      })

      if (attempt === attempts || !RETRYABLE_STATUS.has(response.status)) return response
    } catch (error) {
      if (callerSignal?.aborted) throw callerSignal.reason ?? error
      const retryable = timeout.didTimeout()
        || (error instanceof TypeError && !callerSignal?.aborted)
      if (attempt === attempts || !retryable) throw error
    } finally {
      timeout.cleanup()
    }

    await wait(options.retryDelayMs ?? 350)
  }

  throw new Error('Unreachable request retry state')
}
