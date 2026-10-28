import { requestWithRetry } from '../../app/apiRequest'
import { isNativeApp } from '../../app/mobileApi'

type RecognitionResultItem = {
  0?: { transcript?: string }
  isFinal?: boolean
}
type RecognitionEventLike = {
  resultIndex?: number
  results?: ArrayLike<RecognitionResultItem>
}

type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => RecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
}

export type SpeechCaptureErrorReason = 'permission-denied' | 'no-speech' | 'recognition-error' | 'start-failed'

export type SpeechCaptureCallbacks = {
  onInterim?: (transcript: string) => void
  onComplete: (transcript: string) => void
  onError: (reason: SpeechCaptureErrorReason) => void
}

export type SpeechCapture = {
  stop: () => void
  cancel: () => void
}

export type SpeechPlayback = {
  cancel: () => void
}

type NativeSpeechPlugin = {
  available: () => Promise<{ available: boolean }>
  checkPermissions: () => Promise<{ speechRecognition: string }>
  requestPermissions: () => Promise<{ speechRecognition: string }>
  addListener: (
    eventName: 'partialResults' | 'listeningState',
    listener: (payload: any) => void,
  ) => Promise<{ remove: () => Promise<void> }>
  start: (options: Record<string, unknown>) => Promise<{ matches?: string[] }>
  stop: () => Promise<void>
}

export async function requestSpeechAudio(text: string, signal?: AbortSignal): Promise<Blob> {
  const response = await requestWithRetry('/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  }, {
    attempts: 1,
    timeoutMs: 25_000,
  })
  if (!response.ok) throw new Error('tts_failed')
  const audio = await response.blob()
  if (!audio.type.startsWith('audio/') || audio.size === 0) throw new Error('tts_invalid_audio')
  return audio
}

function createNativeSpeechCapture(
  { onInterim, onComplete, onError }: SpeechCaptureCallbacks,
  {
    loadPlugin,
    stopFinalizeMs = 700,
    maxListeningMs = 12_000,
  }: {
    loadPlugin: () => Promise<NativeSpeechPlugin>
    stopFinalizeMs?: number
    maxListeningMs?: number
  },
): SpeechCapture {
  let active = true
  let stopRequested = false
  let latestTranscript = ''
  let plugin: NativeSpeechPlugin | null = null
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  let listeningTimer: ReturnType<typeof setTimeout> | null = null
  const listenerHandles: Array<{ remove: () => Promise<void> }> = []

  const cleanup = () => {
    if (stopTimer !== null) clearTimeout(stopTimer)
    if (listeningTimer !== null) clearTimeout(listeningTimer)
    stopTimer = null
    listeningTimer = null
    for (const handle of listenerHandles.splice(0)) void handle.remove()
  }

  const finish = (error?: SpeechCaptureErrorReason) => {
    if (!active) return
    active = false
    cleanup()
    const transcript = latestTranscript.trim()
    if (transcript) onComplete(transcript)
    else onError(error ?? 'no-speech')
  }

  const armListeningTimeout = () => {
    if (listeningTimer !== null) clearTimeout(listeningTimer)
    listeningTimer = setTimeout(() => finish(), maxListeningMs)
  }

  void (async () => {
    plugin = await loadPlugin()
    if (!active) return
    const availability = await plugin.available()
    if (!active) return
    if (!availability.available) {
      finish('start-failed')
      return
    }

    let permission = await plugin.checkPermissions()
    if (!active) return
    if (permission.speechRecognition === 'prompt' || permission.speechRecognition === 'prompt-with-rationale') {
      permission = await plugin.requestPermissions()
    }
    if (!active) return
    if (permission.speechRecognition !== 'granted') {
      finish('permission-denied')
      return
    }

    if (stopRequested) {
      await plugin.stop()
      finish()
      return
    }

    listenerHandles.push(await plugin.addListener('partialResults', ({ matches }) => {
      if (!active) return
      const transcript = matches?.[0]?.trim() ?? ''
      if (!transcript) return
      latestTranscript = transcript
      armListeningTimeout()
      onInterim?.(transcript)
    }))
    listenerHandles.push(await plugin.addListener('listeningState', ({ status }) => {
      if (status === 'stopped') finish()
    }))

    await plugin.start({
      language: 'zh-CN',
      maxResults: 1,
      prompt: '请说出你想问的问题',
      partialResults: true,
      popup: false,
    })
    if (stopRequested) void plugin.stop()
    armListeningTimeout()
  })().catch(() => finish('start-failed'))

  return {
    stop: () => {
      if (!active || stopRequested) return
      stopRequested = true
      void plugin?.stop()
      if (stopTimer !== null) clearTimeout(stopTimer)
      stopTimer = setTimeout(() => finish(), stopFinalizeMs)
    },
    cancel: () => {
      active = false
      cleanup()
      void plugin?.stop()
    },
  }
}

export function startNativeSpeechCaptureForTest(
  callbacks: SpeechCaptureCallbacks,
  { plugin, stopFinalizeMs = 700, maxListeningMs = 12_000 }: {
    plugin: NativeSpeechPlugin
    stopFinalizeMs?: number
    maxListeningMs?: number
  },
): SpeechCapture {
  return createNativeSpeechCapture(callbacks, {
    loadPlugin: async () => plugin,
    stopFinalizeMs,
    maxListeningMs,
  })
}

function startNativeSpeechCapture(callbacks: SpeechCaptureCallbacks): SpeechCapture {
  return createNativeSpeechCapture(callbacks, {
    loadPlugin: async () => {
      const module = await import('@capacitor-community/speech-recognition')
      return module.SpeechRecognition as NativeSpeechPlugin
    },
  })
}

export function startSpeechCapture({ onInterim, onComplete, onError }: SpeechCaptureCallbacks): SpeechCapture | null {
  if (isNativeApp()) return startNativeSpeechCapture({ onInterim, onComplete, onError })
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!Recognition) return null

  const recognition = new Recognition()
  let finalTranscript = ''
  let latestInterimTranscript = ''
  let finished = false

  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  recognition.onresult = (event) => {
    const start = event.resultIndex ?? 0
    const results = event.results ?? []
    let interimTranscript = ''
    for (let index = start; index < results.length; index += 1) {
      const result = results[index]
      const text = result?.[0]?.transcript ?? ''
      if (result?.isFinal) finalTranscript += text
      else interimTranscript += text
    }
    if (interimTranscript.trim()) {
      latestInterimTranscript = interimTranscript.trim()
      onInterim?.(latestInterimTranscript)
    }
  }
  recognition.onerror = (event) => {
    if (finished) return
    if (event.error === 'aborted') return
    finished = true
    const reason = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'permission-denied'
      : event.error === 'no-speech'
        ? 'no-speech'
        : 'recognition-error'
    onError(reason)
  }
  recognition.onend = () => {
    if (finished) return
    finished = true
    const transcript = finalTranscript.trim() || latestInterimTranscript
    if (transcript) onComplete(transcript)
    else onError('no-speech')
  }

  try {
    recognition.start()
  } catch {
    onError('start-failed')
    return null
  }

  return {
    stop: () => recognition.stop(),
    cancel: () => {
      finished = true
      recognition.abort()
    },
  }
}

export function speakCompanionReply(text: string, enabled: boolean, onEnd?: () => void): SpeechPlayback | null {
  if (enabled && isNativeApp()) {
    return startNativeSpeechWithFallback(text, onEnd)
  }
  if (!enabled || typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') return null

  const synthesis = window.speechSynthesis
  try {
    synthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = .96
    utterance.pitch = 1
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    synthesis.speak(utterance)
  } catch {
    onEnd?.()
  }
  return { cancel: () => synthesis.cancel() }
}

function startNativeSpeechWithFallback(text: string, onEnd?: () => void): SpeechPlayback {
  let stopped = false
  let finished = false
  let nativeStarted = false
  let audio: HTMLAudioElement | null = null
  let objectUrl = ''
  const controller = new AbortController()

  const revokeAudio = () => {
    if (!objectUrl) return
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }

  const finish = () => {
    if (finished) return
    finished = true
    revokeAudio()
    onEnd?.()
  }

  const playNativeFallback = async () => {
    if (stopped) return
    try {
      const { TextToSpeech, QueueStrategy } = await import('@capacitor-community/text-to-speech')
      if (stopped) return
      nativeStarted = true
      await TextToSpeech.stop()
      if (stopped) return
      await TextToSpeech.speak({
        text,
        lang: 'zh-CN',
        rate: .96,
        pitch: 1,
        queueStrategy: QueueStrategy.Flush,
      })
      if (!stopped) finish()
    } catch {
      if (!stopped) finish()
    }
  }

  void (async () => {
    try {
      const blob = await requestSpeechAudio(text, controller.signal)
      if (stopped) return
      if (typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') {
        await playNativeFallback()
        return
      }
      objectUrl = URL.createObjectURL(blob)
      audio = new Audio(objectUrl)
      audio.onended = finish
      audio.onerror = () => {
        revokeAudio()
        void playNativeFallback()
      }
      await audio.play()
    } catch {
      if (!stopped) await playNativeFallback()
    }
  })()

  return {
    cancel: () => {
      stopped = true
      controller.abort()
      audio?.pause()
      revokeAudio()
      if (nativeStarted) {
        void import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => TextToSpeech.stop())
      }
    },
  }
}
