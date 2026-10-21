import { afterEach, describe, expect, it, vi } from 'vitest'
import { startSpeechCapture } from './browserSpeech'

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

  it('preserves the browser no-speech reason when recognition reports it directly', () => {
    window.SpeechRecognition = FakeRecognition as unknown as typeof window.SpeechRecognition
    const onError = vi.fn()
    startSpeechCapture({ onComplete: vi.fn(), onError })

    FakeRecognition.latest?.onerror?.({ error: 'no-speech' })

    expect(onError).toHaveBeenCalledWith('no-speech')
  })
})
