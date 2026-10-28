import { describe, expect, it, vi } from 'vitest'
import { createTaskExecutor } from './taskExecutors.mjs'

describe('background task executors', () => {
  it('executes vision and image tasks through the protected API handler', async () => {
    const handleApi = vi.fn(async ({ path }) => (
      path === '/api/companion/recognize'
        ? { status: 200, body: { result: { output: '白色机器人' } } }
        : { status: 200, body: { data: [{ url: 'https://image.test/a.png' }] } }
    ))
    const execute = createTaskExecutor({ handleApi, brainOrigin: 'http://brain.test' })
    const stage = vi.fn(async () => undefined)

    await expect(execute({ kind: 'vision', payload: { tool: 'object' }, updateStage: stage }))
      .resolves.toEqual({ output: '白色机器人' })
    await expect(execute({ kind: 'product-image', payload: { prompt: '小灯' }, updateStage: stage }))
      .resolves.toEqual({ data: [{ url: 'https://image.test/a.png' }] })
    expect(stage).toHaveBeenCalledWith('recognizing')
    expect(stage).toHaveBeenCalledWith('rendering')
  })

  it('executes film-image through the internal brain service', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ src: 'data:image/png;base64,AA' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const execute = createTaskExecutor({
      handleApi: vi.fn(),
      brainOrigin: 'http://127.0.0.1:8766',
      fetchImpl,
    })

    await expect(execute({
      kind: 'film-image',
      payload: { prompt: '机器人' },
      updateStage: vi.fn(),
    })).resolves.toEqual({ src: 'data:image/png;base64,AA' })
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8766/api/image', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ prompt: '机器人' }),
    }))
  })

  it('rejects unknown task kinds and propagates stable API errors', async () => {
    const execute = createTaskExecutor({
      handleApi: async () => ({ status: 502, body: { error: 'provider_error' } }),
      brainOrigin: 'http://brain.test',
    })

    await expect(execute({ kind: 'vision', payload: {}, updateStage: vi.fn() }))
      .rejects.toThrow('provider_error')
    await expect(execute({ kind: 'unknown', payload: {}, updateStage: vi.fn() }))
      .rejects.toThrow('invalid_task_kind')
  })
})
