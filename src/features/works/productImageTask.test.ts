import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearProductImageTask, readProductImageTask, startProductImageTask } from '../../../apps/creative-module/src/lib/productImageTask'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('creative product image task persistence', () => {
  it('stores the task id and prompt for a later game reopen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      taskId: 'task-product-1',
      kind: 'product-image',
      status: 'queued',
      createdAt: '2026-10-28T15:00:00.000Z',
      updatedAt: '2026-10-28T15:00:00.000Z',
      elapsedMs: 0,
    }), { status: 202, headers: { 'content-type': 'application/json' } })))

    await startProductImageTask('会发光的小夜灯', 'client-1')

    expect(readProductImageTask()).toMatchObject({
      taskId: 'task-product-1',
      prompt: '会发光的小夜灯',
    })
    clearProductImageTask()
    expect(readProductImageTask()).toBeNull()
  })
})
