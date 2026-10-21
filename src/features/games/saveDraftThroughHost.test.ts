import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestDraftSave,
  WORK_SAVE_FAILED,
  WORK_SAVED,
} from '@zhiya/works-bridge'

const input = {
  source: 'creative-module' as const,
  draftId: 'draft-1',
  title: '分类小车',
  description: '',
  fileName: 'car.json',
  blob: new Blob(['{}']),
}

describe('requestDraftSave', () => {
  afterEach(() => vi.useRealTimers())

  it('收到宿主回执后解析作品 ID', async () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage')
    const request = requestDraftSave(input)

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: window.parent,
        data: {
          type: WORK_SAVED,
          version: 1,
          source: 'creative-module',
          draftId: 'draft-1',
          workId: 'work-9',
        },
      }))
    })

    await expect(request).resolves.toEqual({ workId: 'work-9' })
    expect(postMessage).toHaveBeenCalledOnce()
  })

  it('宿主保存失败时拒绝请求', async () => {
    const request = requestDraftSave(input)
    window.dispatchEvent(new MessageEvent('message', {
      source: window.parent,
      data: {
        type: WORK_SAVE_FAILED,
        version: 1,
        source: 'creative-module',
        draftId: 'draft-1',
        errorCode: 'storage-error',
      },
    }))
    await expect(request).rejects.toThrow('storage-error')
  })
})
