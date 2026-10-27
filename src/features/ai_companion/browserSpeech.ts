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

function startNativeSpeechCapture({
  onInterim,
  onComplete,
  onError,
}: SpeechCaptureCallbacks): SpeechCapture {
  let active = true
  let latestTranscript = ''
  let plugin: typeof import('@capacitor-community/speech-recognition')['SpeechRecognition'] | null = null
  const listenerHandles: Array<{ remove: () => Promise<void> }> = []

  const cleanup = () => {
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

  void (async () => {
    const module = await import('@capacitor-community/speech-recognition')
    plugin = module.SpeechRecognition
    const availability = await plugin.available()
    if (!availability.available) {
      finish('start-failed')
      return
    }

    let permission = await plugin.checkPermissions()
    if (permission.speechRecognition === 'prompt' || permission.speechRecognition === 'prompt-with-rationale') {
      permission = await plugin.requestPermissions()
    }
    if (permission.speechRecognition !== 'granted') {
      finish('permission-denied')
      return
    }

    listenerHandles.push(await plugin.addListener('partialResults', ({ matches }) => {
      if (!active) return
      const transcript = matches?.[0]?.trim() ?? ''
      if (!transcript) return
      latestTranscript = transcript
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
  })().catch(() => finish('start-failed'))

  return {
    stop: () => { void plugin?.stop() },
    cancel: () => {
      active = false
      cleanup()
      void plugin?.stop()
    },
  }
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
    let stopped = false
    void import('@capacitor-community/text-to-speech').then(async ({ TextToSpeech, QueueStrategy }) => {
      await TextToSpeech.stop()
      if (stopped) return
      await TextToSpeech.speak({
        text,
        lang: 'zh-CN',
        rate: .96,
        pitch: 1,
        queueStrategy: QueueStrategy.Flush,
      })
      if (!stopped) onEnd?.()
    }).catch(() => onEnd?.())
    return {
      cancel: () => {
        stopped = true
        void import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => TextToSpeech.stop())
      },
    }
  }
  if (!enabled || typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') return null

  const synthesis = window.speechSynthesis
  synthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = .96
  utterance.pitch = 1
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  synthesis.speak(utterance)
  return { cancel: () => synthesis.cancel() }
}
