import { describe, expect, it, vi } from 'vitest'
import {
  isSaveDraftMessage,
  postDraftToHost,
  WORK_SAVE_DRAFT,
  WORK_SAVE_FAILED,
  WORK_SAVED,
} from '@zhiya/works-bridge'

describe('works bridge protocol', () => {
  it('只接受版本正确且带 Blob 的草稿', () => {
    expect(isSaveDraftMessage({
      type: WORK_SAVE_DRAFT,
      version: 1,
      source: 'brain-film',
      draftId: 'film-1',
      title: '云朵电影院',
      description: '',
      fileName: '云朵电影院.bhfilm',
      blob: new Blob(['{}'], { type: 'application/json' }),
    })).toBe(true)
    expect(isSaveDraftMessage({ type: WORK_SAVE_DRAFT, version: 2 })).toBe(false)
  })

  it('拒绝未知来源、超长字段和缺失文件', () => {
    const base = {
      type: WORK_SAVE_DRAFT,
      version: 1,
      source: 'brain-film',
      draftId: 'film-1',
      title: '云朵电影院',
      description: '',
      fileName: 'film.bhfilm',
      blob: new Blob(['film']),
    }
    expect(isSaveDraftMessage({ ...base, source: 'unknown-game' })).toBe(false)
    expect(isSaveDraftMessage({ ...base, title: '长'.repeat(81) })).toBe(false)
    expect(isSaveDraftMessage({ ...base, description: '长'.repeat(501) })).toBe(false)
    expect(isSaveDraftMessage({ ...base, fileName: '' })).toBe(false)
    expect(isSaveDraftMessage({ ...base, blob: 'not-a-blob' })).toBe(false)
  })

  it('通过 parent 发送带类型的版本化消息', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('window', { parent: { postMessage } })

    postDraftToHost({
      source: 'creative-module',
      draftId: 'module-1',
      title: '分类小车',
      description: '',
      fileName: 'module.json',
      blob: new Blob(['{}']),
    })

    expect(postMessage).toHaveBeenCalledWith({
      type: WORK_SAVE_DRAFT,
      version: 1,
      source: 'creative-module',
      draftId: 'module-1',
      title: '分类小车',
      description: '',
      fileName: 'module.json',
      blob: expect.any(Blob),
    }, '*')
    vi.unstubAllGlobals()
  })

  it('回执常量保持宿主与子应用一致', () => {
    expect(WORK_SAVED).toBe('zhiya.work.saved.v1')
    expect(WORK_SAVE_FAILED).toBe('zhiya.work.save-failed.v1')
  })
})
