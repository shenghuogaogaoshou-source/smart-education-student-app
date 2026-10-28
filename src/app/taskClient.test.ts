import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTask, getTask, pollTask } from '@zhiya/task-client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('shared task client', () => {
  it('creates and reads a task through the shared API', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ taskId: 'task-1', status: 'queued' }, 202))
      .mockResolvedValueOnce(jsonResponse({ taskId: 'task-1', status: 'succeeded', result: { ok: true } }))

    await expect(createTask({
      kind: 'vision',
      payload: { tool: 'object' },
      clientTaskId: 'camera-1',
    }, { fetcher })).resolves.toMatchObject({ taskId: 'task-1', status: 'queued' })
    await expect(getTask('task-1', { fetcher })).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/tasks', expect.objectContaining({ method: 'POST' }))
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/tasks/task-1', expect.objectContaining({ method: 'GET' }))
  })

  it('prefixes task requests with an explicit API origin', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ taskId: 'task-1', status: 'queued' }, 202),
    )

    await createTask({
      kind: 'vision',
      payload: { tool: 'object' },
      clientTaskId: 'camera-1',
    }, {
      fetcher,
      baseUrl: 'https://api.zhiya.test',
    })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.zhiya.test/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('polls with one-second cadence before ten seconds', async () => {
    vi.useFakeTimers()
    let clock = 0
    const timeout = vi.fn((callback: () => void) => { callback(); return 1 })
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ taskId: 't', status: 'running', stage: 'recognizing' }))
      .mockResolvedValueOnce(jsonResponse({ taskId: 't', status: 'succeeded', result: { output: '机器人' } }))

    const result = await pollTask('t', {
      fetcher,
      setTimeoutImpl: timeout as unknown as typeof setTimeout,
      clearTimeoutImpl: vi.fn() as unknown as typeof clearTimeout,
      now: () => clock,
    })

    expect(result.status).toBe('succeeded')
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it('retries one temporary task read failure', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse({ taskId: 't', status: 'running' }))

    await expect(getTask('t', { fetcher, retryDelayMs: 0 })).resolves.toMatchObject({ status: 'running' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('stops polling when the caller aborts', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn(async () => {
      controller.abort()
      return jsonResponse({ taskId: 't', status: 'running' })
    })

    await expect(pollTask('t', { fetcher, signal: controller.signal, retryDelayMs: 0 }))
      .rejects.toMatchObject({ name: 'AbortError' })
  })
})
