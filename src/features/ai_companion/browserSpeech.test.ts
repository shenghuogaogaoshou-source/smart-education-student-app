import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestSpeechAudio,
  speakCompanionReply,
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
})
