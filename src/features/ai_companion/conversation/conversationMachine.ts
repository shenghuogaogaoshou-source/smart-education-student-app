import type {
  SpeechCapture,
  SpeechCaptureCallbacks,
  SpeechCaptureErrorReason,
  SpeechPlayback,
} from '../browserSpeech'
import type { CompanionMotion } from '../render2d/types'

export type ConversationStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'

export type ConversationSnapshot = {
  status: ConversationStatus
  interimText: string
  question: string
  reply: string
  errorReason: SpeechCaptureErrorReason | 'not-supported' | 'request-error' | null
}

export function motionForConversationStatus(status: ConversationStatus): CompanionMotion {
  if (status === 'listening' || status === 'transcribing') return 'listen'
  if (status === 'thinking') return 'think'
  if (status === 'speaking') return 'speak'
  if (status === 'error') return 'tilt'
  return 'idle'
}

type ReplyRequest = {
  companionId: string
  question: string
  signal: AbortSignal
}

type ConversationDependencies = {
  startCapture: (callbacks: SpeechCaptureCallbacks) => SpeechCapture | null
  requestReply: (request: ReplyRequest) => Promise<string>
  speakReply: (text: string, enabled: boolean, onEnd?: () => void) => SpeechPlayback | null
  getCompanionId: () => string
  getVoiceEnabled: () => boolean
}

const INITIAL_SNAPSHOT: ConversationSnapshot = {
  status: 'idle',
  interimText: '',
  question: '',
  reply: '',
  errorReason: null,
}

export function createConversationController(deps: ConversationDependencies) {
  let snapshot = { ...INITIAL_SNAPSHOT }
  let capture: SpeechCapture | null = null
  let requestController: AbortController | null = null
  let playback: SpeechPlayback | null = null
  let requestVersion = 0
  const listeners = new Set<(next: ConversationSnapshot) => void>()

  const publish = (next: ConversationSnapshot) => {
    snapshot = next
    listeners.forEach((listener) => listener(snapshot))
  }

  const update = (patch: Partial<ConversationSnapshot>) => {
    publish({ ...snapshot, ...patch })
  }

  const stopActiveWork = () => {
    capture?.cancel()
    capture = null
    requestController?.abort()
    requestController = null
    playback?.cancel()
    playback = null
    requestVersion += 1
  }

  const submitQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim()
    if (!question) {
      update({ status: 'error', interimText: '', errorReason: 'no-speech' })
      return
    }

    capture?.cancel()
    capture = null
    requestController?.abort()
    playback?.cancel()
    playback = null
    const currentVersion = ++requestVersion
    const controller = new AbortController()
    requestController = controller
    update({ status: 'thinking', interimText: '', question, reply: '', errorReason: null })

    try {
      const reply = await deps.requestReply({
        companionId: deps.getCompanionId(),
        question,
        signal: controller.signal,
      })
      if (controller.signal.aborted || currentVersion !== requestVersion) return
      requestController = null
      update({ status: 'speaking', reply, errorReason: null })
      const finish = () => {
        if (currentVersion !== requestVersion || snapshot.status !== 'speaking') return
        playback = null
        update({ status: 'idle' })
      }
      try {
        playback = deps.speakReply(reply, deps.getVoiceEnabled(), finish)
      } catch {
        // A device without a working speech engine should still keep the written answer.
        update({ status: 'idle', errorReason: null })
        return
      }
      if (!playback && snapshot.status === 'speaking') finish()
    } catch (error) {
      if (controller.signal.aborted || currentVersion !== requestVersion) return
      requestController = null
      update({ status: 'error', errorReason: 'request-error' })
    }
  }

  const start = () => {
    stopActiveWork()
    publish({ ...INITIAL_SNAPSHOT, status: 'listening' })
    capture = deps.startCapture({
      onInterim: (interimText) => {
        if (!capture) return
        update({ status: 'transcribing', interimText, errorReason: null })
      },
      onComplete: (question) => {
        capture = null
        const normalizedQuestion = question.trim()
        if (!normalizedQuestion) {
          update({ status: 'error', interimText: '', errorReason: 'no-speech' })
          return
        }
        if (snapshot.status !== 'transcribing') {
          update({ status: 'transcribing', interimText: normalizedQuestion, errorReason: null })
        } else {
          snapshot = { ...snapshot, interimText: normalizedQuestion }
        }
        void submitQuestion(normalizedQuestion)
      },
      onError: (errorReason) => {
        capture = null
        update({ status: 'error', interimText: '', errorReason })
      },
    })
    if (!capture && snapshot.status !== 'error') update({ status: 'error', errorReason: 'not-supported' })
  }

  return {
    start,
    stop: () => capture?.stop(),
    cancel: () => {
      stopActiveWork()
      publish({ ...INITIAL_SNAPSHOT })
    },
    submitText: submitQuestion,
    getSnapshot: () => snapshot,
    subscribe(listener: (next: ConversationSnapshot) => void) {
      listeners.add(listener)
      listener(snapshot)
      return () => listeners.delete(listener)
    },
  }
}
