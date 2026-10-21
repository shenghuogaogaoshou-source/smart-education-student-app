import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WORK_SAVE_DRAFT, WORK_SAVED } from '@zhiya/works-bridge'
import { GameWorkBridge } from './GameWorkBridge'

describe('GameWorkBridge', () => {
  it('只接收当前 iframe 的已配置来源', async () => {
    const saveDraft = vi.fn().mockResolvedValue({ id: 'work-1' })
    render(
      <GameWorkBridge gameId="brain-film" saveDraft={saveDraft}>
        <iframe title="game" />
      </GameWorkBridge>,
    )
    const iframe = screen.getByTitle('game') as HTMLIFrameElement
    const sourcePostMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')
    const validSaveDraftMessage = () => ({
      type: WORK_SAVE_DRAFT,
      version: 1,
      source: 'brain-film',
      draftId: 'film-1',
      title: '云朵电影院',
      description: '',
      fileName: 'film.bhfilm',
      blob: new Blob(['film'], { type: 'application/json' }),
    })

    fireEvent(window, new MessageEvent('message', {
      origin: 'https://evil.example',
      source: iframe.contentWindow,
      data: validSaveDraftMessage(),
    }))
    expect(saveDraft).not.toHaveBeenCalled()

    fireEvent(window, new MessageEvent('message', {
      origin: 'http://127.0.0.1:5191',
      source: iframe.contentWindow,
      data: validSaveDraftMessage(),
    }))

    await waitFor(() => expect(saveDraft).toHaveBeenCalledOnce())
    await waitFor(() => expect(sourcePostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: WORK_SAVED, source: 'brain-film', draftId: 'film-1', workId: 'work-1' }),
      'http://127.0.0.1:5191',
    ))
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      source: 'brain-film',
      sourceDraftId: 'film-1',
      aiTools: ['脑洞放映厅'],
    }))
  })
})
