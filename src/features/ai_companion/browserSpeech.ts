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

type RecordedAudioStream = {
  getTracks: () => Array<{ stop: () => void }>
}

type RecordedAudioRecorder = {
  state: string
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null
  onstop: (() => void) | null
  onerror: (() => void) | null
  start: (timesliceMs?: number) => void
  stop: () => void
}

type RecordedSpeechCaptureDependencies = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<RecordedAudioStream>
  createRecorder: (stream: RecordedAudioStream, options?: MediaRecorderOptions) => RecordedAudioRecorder
  requestTranscription: (audio: Blob, signal: AbortSignal) => Promise<string>
  maxListeningMs?: number
}

export type NativeSpeechSession = {
  nativePreferred: boolean
}

export function createNativeSpeechSession(): NativeSpeechSession {
  return { nativePreferred: false }
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('audio_read_failed'))
    }
    reader.onerror = () => reject(reader.error || new Error('audio_read_failed'))
    reader.readAsDataURL(blob)
  })
}

export async function requestSpeechTranscription(audio: Blob, signal?: AbortSignal): Promise<string> {
  const dataUrl = await blobToDataUrl(audio)
  const response = await requestWithRetry('/api/companion/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audio: dataUrl }),
    signal,
  }, {
    attempts: 1,
    timeoutMs: 35_000,
  })
  if (!response.ok) throw new Error('transcription_failed')
  const data = await response.json()
  const text = typeof data?.text === 'string' ? data.text.trim() : ''
  if (!text) throw new Error('transcription_empty')
  return text
}

function createRecordedSpeechCapture(
  { onComplete, onError }: SpeechCaptureCallbacks,
  {
    getUserMedia,
    createRecorder,
    requestTranscription,
    maxListeningMs = 12_000,
  }: RecordedSpeechCaptureDependencies,
): SpeechCapture {
  let active = true
  let stopRequested = false
  let finalized = false
  let stream: RecordedAudioStream | null = null
  let recorder: RecordedAudioRecorder | null = null
  let listeningTimer: ReturnType<typeof setTimeout> | null = null
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  const chunks: Blob[] = []
  const transcriptionController = new AbortController()

  const cleanup = () => {
    if (listeningTimer !== null) clearTimeout(listeningTimer)
    if (stopTimer !== null) clearTimeout(stopTimer)
    listeningTimer = null
    stopTimer = null
  }

  const stopTracks = () => {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  const fail = (reason: SpeechCaptureErrorReason) => {
    if (!active || finalized) return
    active = false
    finalized = true
    cleanup()
    stopTracks()
    onError(reason)
  }

  const finalize = async () => {
    if (!active || finalized) return
    finalized = true
    cleanup()
    stopTracks()
    const audio = new Blob(chunks, { type: recorder?.mimeType || chunks[0]?.type || 'audio/webm' })
    if (audio.size === 0) {
      active = false
      onError('no-speech')
      return
    }
    try {
      const text = await requestTranscription(audio, transcriptionController.signal)
      active = false
      if (text.trim()) onComplete(text.trim())
      else onError('no-speech')
    } catch (error) {
      active = false
      if ((error as Error).name !== 'AbortError') onError('recognition-error')
    }
  }

  void (async () => {
    try {
      stream = await getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (error) {
      const denied = error instanceof DOMException
        && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      fail(denied ? 'permission-denied' : 'start-failed')
      return
    }
    if (!active) {
      stopTracks()
      return
    }

    try {
      const typeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType = typeCandidates.find((candidate) => (
        typeof MediaRecorder !== 'undefined'
        && typeof MediaRecorder.isTypeSupported === 'function'
        && MediaRecorder.isTypeSupported(candidate)
      ))
      recorder = createRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = ({ data }) => {
        if (active && data.size > 0) chunks.push(data)
      }
      recorder.onstop = () => { void finalize() }
      recorder.onerror = () => fail('recognition-error')
      recorder.start(250)
      listeningTimer = setTimeout(() => {
        if (recorder && recorder.state !== 'inactive') recorder.stop()
      }, maxListeningMs)
      if (stopRequested && recorder.state !== 'inactive') recorder.stop()
    } catch {
      fail('start-failed')
    }
  })()

  return {
    stop: () => {
      if (!active || stopRequested) return
      stopRequested = true
      if (recorder && recorder.state !== 'inactive') {
        stopTimer = setTimeout(() => { void finalize() }, 1_500)
        recorder.stop()
      }
    },
    cancel: () => {
      active = false
      finalized = true
      cleanup()
      transcriptionController.abort()
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop()
      } catch {
        // Recorder already stopped.
      }
      stopTracks()
    },
  }
}

export function startRecordedSpeechCaptureForTest(
  callbacks: SpeechCaptureCallbacks,
  dependencies: RecordedSpeechCaptureDependencies,
): SpeechCapture {
  return createRecordedSpeechCapture(callbacks, dependencies)
}

function startRecordedSpeechCapture(callbacks: SpeechCaptureCallbacks): SpeechCapture {
  return createRecordedSpeechCapture(callbacks, {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createRecorder: (stream, options) => (
      new MediaRecorder(stream as MediaStream, options) as unknown as RecordedAudioRecorder
    ),
    requestTranscription: requestSpeechTranscription,
  })
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
    let permission = await plugin.requestPermissions()
    if (!active) return
    if (permission.speechRecognition !== 'granted') {
      finish('permission-denied')
      return
    }

    const availability = await plugin.available()
    if (!active) return
    if (!availability.available) {
      finish('start-failed')
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
  if (isNativeApp()) {
    const mediaDevices = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices
    if (typeof MediaRecorder !== 'undefined' && mediaDevices) {
      return startRecordedSpeechCapture({ onInterim, onComplete, onError })
    }
    return startNativeSpeechCapture({ onInterim, onComplete, onError })
  }
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

export function speakCompanionReply(
  text: string,
  enabled: boolean,
  onEnd?: () => void,
  session: NativeSpeechSession = createNativeSpeechSession(),
): SpeechPlayback | null {
  if (enabled && isNativeApp()) {
    return startNativeSpeechWithFallback(text, onEnd, session)
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

type NativeSpeechDependencies = {
  session: NativeSpeechSession
  isNative: boolean
  requestAudio: (text: string, signal: AbortSignal) => Promise<Blob>
  speakNative: (text: string) => Promise<void>
  stopNative: () => Promise<void>
  createAudio: (url: string) => HTMLAudioElement
}

function defaultNativeSpeechDependencies(session: NativeSpeechSession): NativeSpeechDependencies {
  return {
    session,
    isNative: true,
    requestAudio: requestSpeechAudio,
    speakNative: async (text) => {
      const { TextToSpeech, QueueStrategy } = await import('@capacitor-community/text-to-speech')
      await TextToSpeech.speak({
        text,
        lang: 'zh-CN',
        rate: .96,
        pitch: 1,
        queueStrategy: QueueStrategy.Flush,
      })
    },
    stopNative: async () => {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
      await TextToSpeech.stop()
    },
    createAudio: (url) => new Audio(url),
  }
}

export function speakCompanionReplyForTest(
  text: string,
  enabled: boolean,
  onEnd: (() => void) | undefined,
  dependencies: {
    isNative: boolean
    session: NativeSpeechSession
    requestAudio: (text: string, signal: AbortSignal) => Promise<Blob>
    speakNative: (text: string) => Promise<void>
    stopNative?: () => Promise<void>
    createAudio?: (url: string) => HTMLAudioElement
  },
): SpeechPlayback | null {
  if (!enabled || !dependencies.isNative) return null
  return startNativeSpeechWithFallback(text, onEnd, dependencies.session, {
    ...dependencies,
    stopNative: dependencies.stopNative ?? (async () => undefined),
    createAudio: dependencies.createAudio ?? ((url) => new Audio(url)),
  })
}

function startNativeSpeechWithFallback(
  text: string,
  onEnd?: () => void,
  session: NativeSpeechSession = createNativeSpeechSession(),
  overrides?: Partial<NativeSpeechDependencies>,
): SpeechPlayback {
  let stopped = false
  let finished = false
  let nativeStarted = false
  let audio: HTMLAudioElement | null = null
  let objectUrl = ''
  const controller = new AbortController()
  const dependencies = {
    ...defaultNativeSpeechDependencies(session),
    ...overrides,
  }
  let cloudTimer: ReturnType<typeof setTimeout> | null = null

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
    if (stopped || nativeStarted) return
    nativeStarted = true
    session.nativePreferred = true
    try {
      await dependencies.stopNative?.()
      await dependencies.speakNative(text)
      if (!stopped) finish()
    } catch {
      if (!stopped) finish()
    }
  }

  if (session.nativePreferred) {
    void playNativeFallback()
    return {
      cancel: () => {
        stopped = true
        controller.abort()
        void dependencies.stopNative?.()
      },
    }
  }

  void (async () => {
    try {
      const blob = await dependencies.requestAudio(text, controller.signal)
      if (stopped) return
      if (cloudTimer !== null) clearTimeout(cloudTimer)
      if (typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') {
        await playNativeFallback()
        return
      }
      objectUrl = URL.createObjectURL(blob)
      audio = dependencies.createAudio(objectUrl)
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

  cloudTimer = setTimeout(() => {
    if (stopped || nativeStarted) return
    controller.abort()
    void playNativeFallback()
  }, 1500)

  return {
    cancel: () => {
      stopped = true
      if (cloudTimer !== null) clearTimeout(cloudTimer)
      controller.abort()
      audio?.pause()
      revokeAudio()
      if (nativeStarted) void dependencies.stopNative?.()
    },
  }
}
