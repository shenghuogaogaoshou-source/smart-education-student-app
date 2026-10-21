import { describe, expect, it, vi } from 'vitest'
import type { SpeechCaptureCallbacks } from '../browserSpeech'
import { createConversationController, motionForConversationStatus, type ConversationSnapshot } from './conversationMachine'

function createHarness() {
  let captureCallbacks: SpeechCaptureCallbacks | null = null
  let finishSpeaking: (() => void) | null = null
  const capture = { stop: vi.fn(), cancel: vi.fn() }
  const requestReply = vi.fn(async () => '雨后的小水滴把阳光分成了不同颜色。')
  const speakReply = vi.fn((_text: string, _enabled: boolean, onEnd?: () => void) => {
    finishSpeaking = onEnd ?? null
    return { cancel: vi.fn() }
  })
  const controller = createConversationController({
    startCapture: (callbacks) => {
      captureCallbacks = callbacks
      return capture
    },
    requestReply,
    speakReply,
    getCompanionId: () => 'momo',
    getVoiceEnabled: () => true,
  })

  return {
    capture,
    controller,
    requestReply,
    speakReply,
    callbacks: () => captureCallbacks,
    finishSpeaking: () => finishSpeaking?.(),
  }
}

describe('companion conversation controller', () => {
  it('maps each conversation phase to the matching companion motion', () => {
    expect(motionForConversationStatus('listening')).toBe('listen')
    expect(motionForConversationStatus('transcribing')).toBe('listen')
    expect(motionForConversationStatus('thinking')).toBe('think')
    expect(motionForConversationStatus('speaking')).toBe('speak')
    expect(motionForConversationStatus('error')).toBe('tilt')
    expect(motionForConversationStatus('idle')).toBe('idle')
  })

  it('moves one voice question through listening, transcription, thinking and speaking', async () => {
    const harness = createHarness()
    const phases: ConversationSnapshot['status'][] = []
    harness.controller.subscribe((snapshot) => phases.push(snapshot.status))

    harness.controller.start()
    harness.callbacks()?.onInterim?.('彩虹为什么')
    harness.callbacks()?.onComplete('彩虹为什么有颜色？')
    await vi.waitFor(() => expect(harness.speakReply).toHaveBeenCalled())
    harness.finishSpeaking()

    expect(phases).toEqual(['idle', 'listening', 'transcribing', 'thinking', 'speaking', 'idle'])
    expect(harness.requestReply).toHaveBeenCalledWith({
      companionId: 'momo',
      question: '彩虹为什么有颜色？',
      signal: expect.any(AbortSignal),
    })
  })

  it('cancels recognition without submitting a partial question', () => {
    const harness = createHarness()

    harness.controller.start()
    harness.callbacks()?.onInterim?.('还没有说完')
    harness.controller.cancel()

    expect(harness.capture.cancel).toHaveBeenCalledTimes(1)
    expect(harness.requestReply).not.toHaveBeenCalled()
    expect(harness.controller.getSnapshot()).toMatchObject({ status: 'idle', question: '', reply: '' })
  })

  it('aborts an older reply when a new question starts and ignores the stale result', async () => {
    let resolveFirst: (reply: string) => void = () => undefined
    const requestReply = vi.fn(({ question }: { question: string; signal: AbortSignal }) => {
      if (question === '第一个问题') return new Promise<string>((resolve) => { resolveFirst = resolve })
      return Promise.resolve('第二个回答')
    })
    const controller = createConversationController({
      startCapture: () => null,
      requestReply,
      speakReply: () => null,
      getCompanionId: () => 'momo',
      getVoiceEnabled: () => false,
    })

    const first = controller.submitText('第一个问题')
    const firstSignal = requestReply.mock.calls[0][0].signal as AbortSignal
    await controller.submitText('第二个问题')
    resolveFirst('过期回答')
    await first

    expect(firstSignal.aborted).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', reply: '第二个回答' })
  })

  it('maps unavailable recognition and recognition errors to a child-safe error state', () => {
    const controller = createConversationController({
      startCapture: () => null,
      requestReply: async () => '不会调用',
      speakReply: () => null,
      getCompanionId: () => 'momo',
      getVoiceEnabled: () => true,
    })

    controller.start()

    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      errorReason: 'not-supported',
    })
  })

  it('preserves a recognition start failure instead of misreporting it as unsupported', () => {
    const controller = createConversationController({
      startCapture: (callbacks) => {
        callbacks.onError('start-failed')
        return null
      },
      requestReply: async () => '不会调用',
      speakReply: () => null,
      getCompanionId: () => 'momo',
      getVoiceEnabled: () => true,
    })

    controller.start()

    expect(controller.getSnapshot()).toMatchObject({ status: 'error', errorReason: 'start-failed' })
  })
})
