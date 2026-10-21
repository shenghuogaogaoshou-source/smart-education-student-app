import { useEffect, useRef, type PropsWithChildren } from 'react'
import {
  isSaveDraftMessage,
  WORK_SAVE_FAILED,
  WORK_SAVED,
} from '@zhiya/works-bridge'
import type { SaveWorkDraftInput, WorkRecord } from '../works/types'
import { getGameConfig, type GameId } from './gameRegistry'

type SaveDraft = (input: SaveWorkDraftInput) => Promise<Pick<WorkRecord, 'id'>>

const AI_TOOL_NAMES: Record<GameId, string> = {
  'brain-film': '脑洞放映厅',
  'creative-module': '创造模块',
}

export function GameWorkBridge({
  gameId,
  saveDraft,
  onStatus,
  children,
}: PropsWithChildren<{
  gameId: GameId
  saveDraft: SaveDraft
  onStatus?: (message: string) => void
}>) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const config = getGameConfig(gameId)

    const handleMessage = async (event: MessageEvent) => {
      const frame = containerRef.current?.querySelector('iframe')
      if (event.origin !== config.allowedOrigin || event.source !== frame?.contentWindow) return
      if (!isSaveDraftMessage(event.data) || event.data.source !== gameId) {
        if (event.data?.type === 'zhiya.work.save-draft.v1') {
          event.source?.postMessage({
            type: WORK_SAVE_FAILED,
            version: 1,
            source: gameId,
            draftId: typeof event.data?.draftId === 'string' ? event.data.draftId : '',
            errorCode: 'invalid-message',
          }, event.origin)
        }
        return
      }

      const message = event.data
      try {
        const record = await saveDraft({
          source: message.source,
          sourceDraftId: message.draftId,
          title: message.title,
          description: message.description,
          aiTools: [AI_TOOL_NAMES[gameId]],
          fileName: message.fileName,
          blob: message.blob,
        })
        event.source?.postMessage({
          type: WORK_SAVED,
          version: 1,
          source: gameId,
          draftId: message.draftId,
          workId: record.id,
        }, event.origin)
        onStatus?.('已保存到智芽·我的作品')
      } catch {
        event.source?.postMessage({
          type: WORK_SAVE_FAILED,
          version: 1,
          source: gameId,
          draftId: message.draftId,
          errorCode: 'storage-error',
        }, event.origin)
        onStatus?.('作品没有保存成功，请再试一次')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [gameId, onStatus, saveDraft])

  return <div ref={containerRef} className="game-work-bridge">{children}</div>
}
