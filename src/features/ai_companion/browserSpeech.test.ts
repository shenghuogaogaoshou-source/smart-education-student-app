import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createNativeSpeechSession,
  requestSpeechAudio,
  speakCompanionReply,
  speakCompanionReplyForTest,
  startRecordedSpeechCaptureForTest,
  startNativeSpeechCaptureForTest,
  startSpeechCapture,
} from './browserSpeech'

type Result = { 0: { transcript: string }; isFinal: boolean }
type RecognitionTestEvent = { resultIndex?: number; results?: ArrayLike<Result> }

class FakeRecognition {
  static latest: FakeRecognition | null = null
  lang = ''
  continuous = true
  interimResults = false
  maxAlternatives = 0
  onresult: ((event: RecognitionTestEvent) => void) | null = null
  onerror: ((event: { error?: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()

  constructor() {
    FakeRecognition.latest = this
  }
}

describe('browser speech capture', () => {
  afterEach(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
    FakeRecognition.latest = null
  })

  it('uses child-friendly Chinese recognition and reports interim and final text separately', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onInterim = vi.fn()
    const onComplete = vi.fn()
    const capture = startSpeechCapture({ onInterim, onComplete, onError: vi.fn() })
    const recognition = FakeRecognition.latest!

    expect(capture).not.toBeNull()
    expect(recognition).toMatchObject({
      lang: 'zh-CN',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
    })

    recognition.onresult?.({
      resultIndex: 0,
      results: [
        { 0: { transcript: '彩虹为' }, isFinal: false },
        { 0: { transcript: '彩虹为什么有颜色' }, isFinal: true },
      ],
    })
    recognition.onend?.()

    expect(onInterim).toHaveBeenCalledWith('彩虹为')
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete).toHaveBeenCalledWith('彩虹为什么有颜色')
  })

  it('stops normally but cancel aborts without completing or reporting an error', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onComplete = vi.fn()
    const onError = vi.fn()
    const capture = startSpeechCapture({ onComplete, onError })!
    const recognition = FakeRecognition.latest!

    capture.stop()
    expect(recognition.stop).toHaveBeenCalledOnce()

    capture.cancel()
    recognition.onend?.()
    recognition.onerror?.({ error: 'aborted' })

    expect(recognition.abort).toHaveBeenCalledOnce()
    expect(onComplete).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports permission denial and no-speech as distinct internal reasons only once', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onError = vi.fn()
    startSpeechCapture({ onComplete: vi.fn(), onError })
    const recognition = FakeRecognition.latest!

    recognition.onerror?.({ error: 'not-allowed' })
    recognition.onend?.()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('permission-denied')
  })

  it('reports no speech when recognition ends without a final transcript', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onError = vi.fn()
    startSpeechCapture({ onComplete: vi.fn(), onError })

    FakeRecognition.latest?.onend?.()

    expect(onError).toHaveBeenCalledWith('no-speech')
  })

  it('uses the latest interim transcript when recognition ends without finalizing it', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onComplete = vi.fn()
    const onError = vi.fn()
    startSpeechCapture({ onComplete, onError })
    const recognition = FakeRecognition.latest!

    recognition.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript: '为什么天空是蓝色的' }, isFinal: false }],
    })
    recognition.onend?.()

    expect(onComplete).toHaveBeenCalledWith('为什么天空是蓝色的')
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps a captured sentence when the browser aborts only to finish the session', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onComplete = vi.fn()
    const onError = vi.fn()
    startSpeechCapture({ onComplete, onError })
    const recognition = FakeRecognition.latest!

    recognition.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript: '雨滴为什么从云里落下来' }, isFinal: false }],
    })
    recognition.onerror?.({ error: 'aborted' })
    recognition.onend?.()

    expect(onComplete).toHaveBeenCalledWith('雨滴为什么从云里落下来')
    expect(onError).not.toHaveBeenCalled()
  })

  it('preserves the browser no-speech reason when recognition reports it directly', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onError = vi.fn()
    startSpeechCapture({ onComplete: vi.fn(), onError })

    FakeRecognition.latest?.onerror?.({ error: 'no-speech' })

    expect(onError).toHaveBeenCalledWith('no-speech')
  })

  it('uses the protected TTS proxy and returns playable audio', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      new Uint8Array([82, 73, 70, 70]),
      { status: 200, headers: { 'content-type': 'audio/wav' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const audio = await requestSpeechAudio('你好呀', new AbortController().signal)

    expect(audio.type).toContain('audio/wav')
    expect(fetchMock).toHaveBeenCalledWith('/api/tts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: '你好呀' }),
    }))
  })

  it('finishes playback cleanly when the local speech engine throws', () => {
    const onEnd = vi.fn()
    vi.stubGlobal('SpeechSynthesisUtterance', function () {})
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      speak: vi.fn(() => {
        throw new Error('native speech unavailable')
      }),
    })

    expect(() => speakCompanionReply('你好', true, onEnd)).not.toThrow()
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('submits the latest transcript when Android never emits a stopped event', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const listeners = new Map<string, (payload: any) => void>()
    const plugin = {
      available: vi.fn(async () => ({ available: true })),
      checkPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
      requestPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
      addListener: vi.fn(async (name: string, listener: (payload: any) => void) => {
        listeners.set(name, listener)
        return { remove: vi.fn(async () => undefined) }
      }),
      start: vi.fn(async () => ({ matches: [] })),
      stop: vi.fn(async () => undefined),
    }
    const capture = startNativeSpeechCaptureForTest(
      { onComplete, onError: vi.fn() },
      { plugin },
    )
    await vi.waitFor(() => expect(plugin.start).toHaveBeenCalled())
    listeners.get('partialResults')?.({ matches: ['你叫什么名字呀'] })
    capture.stop()
    await vi.advanceTimersByTimeAsync(700)
    expect(onComplete).toHaveBeenCalledWith('你叫什么名字呀')
  })

  it('stops immediately after initialization if the finger was released too early', async () => {
    let finishStart: ((value: { matches: string[] }) => void) | undefined
    const plugin = {
      available: vi.fn(async () => ({ available: true })),
      checkPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
      requestPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
      addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
      start: vi.fn((): Promise<{ matches: string[] }> => new Promise((resolve) => {
        finishStart = resolve
      })),
      stop: vi.fn(async () => undefined),
    }
    const capture = startNativeSpeechCaptureForTest(
      { onComplete: vi.fn(), onError: vi.fn() },
      { plugin },
    )
    capture.stop()
    finishStart?.({ matches: [] })
    await vi.waitFor(() => expect(plugin.stop).toHaveBeenCalled())
  })

  it('requests microphone permission before checking Android speech availability', async () => {
    const order: string[] = []
    const plugin = {
      available: vi.fn(async () => {
        order.push('available')
        return { available: true }
      }),
      checkPermissions: vi.fn(async () => ({ speechRecognition: 'prompt' })),
      requestPermissions: vi.fn(async () => {
        order.push('request')
        return { speechRecognition: 'granted' }
      }),
      addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
      start: vi.fn(async () => ({ matches: [] })),
      stop: vi.fn(async () => undefined),
    }

    const capture = startNativeSpeechCaptureForTest(
      { onComplete: vi.fn(), onError: vi.fn() },
      { plugin },
    )

    await vi.waitFor(() => expect(plugin.start).toHaveBeenCalled())
    expect(order).toEqual(['request', 'available'])
    capture.cancel()
  })

  it('records native microphone audio and transcribes it without a system speech service', async () => {
    const onComplete = vi.fn()
    const stopTrack = vi.fn()
    const stop = vi.fn()
    let data: ((event: { data: Blob }) => void) | undefined
    let stopped: (() => void) | undefined
    const recorder = {
      state: 'inactive',
      mimeType: 'audio/webm',
      ondataavailable: null as ((event: { data: Blob }) => void) | null,
      onstop: null as (() => void) | null,
      onerror: null as (() => void) | null,
      start: vi.fn(() => { recorder.state = 'recording' }),
      stop: vi.fn(() => { recorder.state = 'inactive'; stop() }),
    }
    data = (event) => recorder.ondataavailable?.(event)
    stopped = () => recorder.onstop?.()
    const requestTranscription = vi.fn(async () => '为什么天空是蓝色的？')
    const capture = startRecordedSpeechCaptureForTest(
      { onComplete, onError: vi.fn() },
      {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })),
        createRecorder: vi.fn(() => recorder),
        requestTranscription,
      },
    )

    await vi.waitFor(() => expect(recorder.start).toHaveBeenCalled())
    capture.stop()
    expect(recorder.stop).toHaveBeenCalledOnce()
    data?.({ data: new Blob(['voice'], { type: 'audio/webm' }) })
    stopped?.()
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledWith('为什么天空是蓝色的？'))
    expect(requestTranscription).toHaveBeenCalledWith(expect.any(Blob), expect.any(AbortSignal))
    expect(stopTrack).toHaveBeenCalledOnce()
  })

  it('reports microphone permission denial from getUserMedia', async () => {
    const onError = vi.fn()
    startRecordedSpeechCaptureForTest(
      { onComplete: vi.fn(), onError },
      {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
        createRecorder: vi.fn(),
        requestTranscription: vi.fn(),
      },
    )

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('permission-denied'))
  })

  it('starts Android local speech after 1.5 seconds while cloud TTS is pending', async () => {
    vi.useFakeTimers()
    const speakNative = vi.fn(async () => undefined)
    const session = createNativeSpeechSession()
    const playback = speakCompanionReplyForTest('你好', true, undefined, {
      isNative: true,
      session,
      requestAudio: vi.fn((_text: string, _signal: AbortSignal) => new Promise<Blob>(() => undefined)),
      speakNative,
    })
    await vi.advanceTimersByTimeAsync(1500)
    expect(speakNative).toHaveBeenCalledOnce()
    playback?.cancel()
  })
})
