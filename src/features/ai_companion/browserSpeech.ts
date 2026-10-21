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

export function startSpeechCapture({ onInterim, onComplete, onError }: SpeechCaptureCallbacks): SpeechCapture | null {
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!Recognition) return null

  const recognition = new Recognition()
  let finalTranscript = ''
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
    if (interimTranscript.trim()) onInterim?.(interimTranscript.trim())
  }
  recognition.onerror = (event) => {
    if (finished) return
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
    const transcript = finalTranscript.trim()
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
