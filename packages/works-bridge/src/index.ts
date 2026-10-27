export const WORK_SAVE_DRAFT = 'zhiya.work.save-draft.v1' as const
export const WORK_SAVED = 'zhiya.work.saved.v1' as const
export const WORK_SAVE_FAILED = 'zhiya.work.save-failed.v1' as const

export type GameSource = 'brain-film' | 'creative-module'

export type SaveDraftInput = {
  source: GameSource
  draftId: string
  title: string
  description: string
  fileName: string
  blob: Blob
}

export type SaveDraftMessage = SaveDraftInput & {
  type: typeof WORK_SAVE_DRAFT
  version: 1
}

export type WorkSavedMessage = {
  type: typeof WORK_SAVED
  version: 1
  source: GameSource
  draftId: string
  workId: string
}

export type WorkSaveFailedMessage = {
  type: typeof WORK_SAVE_FAILED
  version: 1
  source: GameSource
  draftId: string
  errorCode: 'invalid-message' | 'storage-error'
}

const GAME_SOURCES = new Set<GameSource>(['brain-film', 'creative-module'])

function hasText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

export function isSaveDraftMessage(value: unknown): value is SaveDraftMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<SaveDraftMessage>

  return message.type === WORK_SAVE_DRAFT
    && message.version === 1
    && GAME_SOURCES.has(message.source as GameSource)
    && hasText(message.draftId, 120)
    && hasText(message.title, 80)
    && typeof message.description === 'string'
    && message.description.length <= 500
    && hasText(message.fileName, 200)
    && message.blob instanceof Blob
}

export function postDraftToHost(input: SaveDraftInput) {
  const message: SaveDraftMessage = {
    ...input,
    type: WORK_SAVE_DRAFT,
    version: 1,
  }
  window.parent.postMessage(message, '*')
}

export function requestDraftSave(input: SaveDraftInput, timeoutMs = 8000): Promise<{ workId: string }> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('save-timeout'))
    }, timeoutMs)

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      const message = event.data as Partial<WorkSavedMessage | WorkSaveFailedMessage> | undefined
      if (message?.source !== input.source || message.draftId !== input.draftId) return
      if (message.type === WORK_SAVED && message.version === 1 && typeof message.workId === 'string') {
        window.clearTimeout(timer)
        window.removeEventListener('message', handleMessage)
        resolve({ workId: message.workId })
      } else if (message.type === WORK_SAVE_FAILED && message.version === 1) {
        window.clearTimeout(timer)
        window.removeEventListener('message', handleMessage)
        reject(new Error(message.errorCode ?? 'save-failed'))
      }
    }

    window.addEventListener('message', handleMessage)
    postDraftToHost(input)
  })
}

export function installGameApiShim(service: 'ai' | 'brain') {
  const queryOrigin = new URLSearchParams(window.location.search).get('apiOrigin')
  const normalizeOrigin = (value: string) => {
    try {
      const url = new URL(value)
      return (url.protocol === 'http:' || url.protocol === 'https:') ? url.origin : ''
    } catch {
      return ''
    }
  }
  const rewriteFetch = (origin: string) => {
    const targetOrigin = service === 'brain' ? `${origin}/brain` : origin
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        return originalFetch(`${targetOrigin}${input}`, init)
      }
      return originalFetch(input, init)
    }
  }
  const explicitOrigin = queryOrigin ? normalizeOrigin(queryOrigin) : ''
  if (explicitOrigin) {
    rewriteFetch(explicitOrigin)
    return
  }

  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean }
  }).Capacitor
  const nativeMarker = (() => {
    try {
      return localStorage.getItem('zhiya.nativeApp') === '1'
    } catch {
      return false
    }
  })()
  if (capacitor?.isNativePlatform?.() !== true && !nativeMarker) return

  let origin = ''
  try {
    origin = normalizeOrigin(localStorage.getItem('zhiya.mobileApiOrigin') ?? '')
    if (!origin) {
      const legacy = JSON.parse(localStorage.getItem('zhiya.mobileApiOrigins') ?? '{}') as { aiOrigin?: unknown }
      origin = typeof legacy.aiOrigin === 'string' ? normalizeOrigin(legacy.aiOrigin) : ''
      if (origin) {
        localStorage.setItem('zhiya.mobileApiOrigin', origin)
        localStorage.removeItem('zhiya.mobileApiOrigins')
      }
    }
  } catch {
    return
  }
  if (!origin) return

  rewriteFetch(origin)
}
