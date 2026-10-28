import { MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppState } from '../../app/AppState'
import type { CompanionLoadout } from '../../app/model'
import { isNativeApp } from '../../app/mobileApi'
import { startSpeechCapture, speakCompanionReply } from './browserSpeech'
import { requestCompanionReply } from './companionChat'
import { getCompanionItem } from './companionCatalog'
import { CompanionBubble } from './CompanionBubble'
import {
  createConversationController,
  motionForConversationStatus,
  type ConversationSnapshot,
} from './conversation/conversationMachine'
import { selectCompanionAction } from './interaction/actionSelector'
import { createGestureMachine } from './interaction/gestureMachine'
import { PartnerAppearance } from './PartnerAppearance'
import type { CompanionMotion } from './render2d/types'

type LoginCompanionProps = {
  loadout?: CompanionLoadout
  onBoundsChange: (rect: DOMRect) => void
}

export const LOGIN_COMPANION_HANDOFF_KEY = 'student-app-login-companion-bounds'

function loginConversationError(reason: ConversationSnapshot['errorReason']) {
  if (reason === 'permission-denied') {
    return isNativeApp()
      ? '麦克风权限还没有开启，请到“设置 > 应用 > 智芽 > 权限”中允许使用麦克风。'
      : '麦克风还没有获得允许，可以在浏览器的网站设置中打开麦克风权限。'
  }
  if (reason === 'not-supported') return '当前浏览器暂不支持语音识别，可以登录后用文字和我聊天。'
  if (reason === 'request-error') return '知识问答暂时没有连上，可以稍后再问一次。'
  if (reason === 'start-failed' || reason === 'recognition-error') return '麦克风刚才没有启动成功，可以再试一次。'
  return '我没有听清楚，可以靠近一点再说一次吗？'
}

export function LoginCompanion({ loadout: presentedLoadout, onBoundsChange }: LoginCompanionProps) {
  const { state } = useAppState()
  const loadout = presentedLoadout ?? state.companion
  const appearance = getCompanionItem(loadout.equipped.appearance)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const gestureRef = useRef(createGestureMachine({ longPressMs: 600, moveThreshold: 8 }))
  const recentActionsRef = useRef<string[]>([])
  const suppressClickRef = useRef(false)
  const companionIdRef = useRef(loadout.equipped.appearance ?? 'momo')
  const voiceEnabledRef = useRef(state.voiceEnabled)
  companionIdRef.current = loadout.equipped.appearance ?? 'momo'
  voiceEnabledRef.current = state.voiceEnabled

  const [conversationController] = useState(() => createConversationController({
    startCapture: startSpeechCapture,
    requestReply: requestCompanionReply,
    speakReply: speakCompanionReply,
    getCompanionId: () => companionIdRef.current,
    getVoiceEnabled: () => voiceEnabledRef.current,
  }))
  const [conversation, setConversation] = useState(conversationController.getSnapshot())
  const [reactionMessage, setReactionMessage] = useState('')
  const [reactionMotion, setReactionMotion] = useState<CompanionMotion>('idle')
  const [isInteracting, setIsInteracting] = useState(false)

  const measure = useCallback(() => {
    if (buttonRef.current) onBoundsChange(buttonRef.current.getBoundingClientRect())
  }, [onBoundsChange])

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, loadout.equipped.appearance, loadout.equipped.outfit, loadout.equipped.decoration])

  useEffect(() => {
    const unsubscribe = conversationController.subscribe(setConversation)
    return () => {
      unsubscribe()
      conversationController.cancel()
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    }
  }, [conversationController])

  const showLoginReaction = useCallback(() => {
    conversationController.cancel()
    const reaction = selectCompanionAction({
      scene: 'login',
      recentActions: recentActionsRef.current,
      progress: 0,
    })
    recentActionsRef.current = [reaction.reactionId]
    setReactionMessage(reaction.message)
    setReactionMotion(reaction.motion)
    setIsInteracting(true)
    window.setTimeout(() => setIsInteracting(false), 420)
  }, [conversationController])

  const finishGesture = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsInteracting(false)
    const result = cancelled
      ? gestureRef.current.send({ type: 'cancel', at: Date.now() })
      : gestureRef.current.send({ type: 'up', x: event.clientX, y: event.clientY, at: Date.now() })
    if (result?.kind === 'cancel') conversationController.cancel()
    else if (result?.kind === 'long-press-end') conversationController.stop()
    else if (result?.kind === 'tap') {
      suppressClickRef.current = true
      showLoginReaction()
    }
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Older mobile WebViews may expose pointer APIs without fully implementing capture.
    }
  }

  const startGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // The long-press still works when pointer capture is unavailable.
    }
    gestureRef.current.send({ type: 'down', x: event.clientX, y: event.clientY, at: Date.now() })
    setIsInteracting(true)
    longPressTimerRef.current = window.setTimeout(() => {
      const result = gestureRef.current.send({ type: 'tick', at: Date.now() })
      if (result?.kind === 'long-press') {
        suppressClickRef.current = true
        setIsInteracting(false)
        setReactionMessage('')
        conversationController.start()
      }
    }, 600)
  }

  const moveGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const result = gestureRef.current.send({ type: 'move', x: event.clientX, y: event.clientY, at: Date.now() })
    if (result?.kind === 'drag-start' && longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      setIsInteracting(false)
      suppressClickRef.current = true
    }
  }

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    showLoginReaction()
  }

  const bubbleMessage = conversation.status === 'transcribing'
    ? conversation.interimText
    : conversation.reply || (conversation.status === 'error' ? loginConversationError(conversation.errorReason) : reactionMessage)
  const bubbleState = conversation.status === 'idle' && !conversation.reply ? 'idle' : conversation.status
  const motion = conversation.status === 'idle'
    ? reactionMotion
    : motionForConversationStatus(conversation.status)

  return (
    <section className="login-companion" aria-label="登录页 AI 伙伴">
      <CompanionBubble state={bubbleState} message={bubbleMessage} className="login-companion__bubble" />
      <button
        ref={buttonRef}
        className={`login-companion__target ${isInteracting ? 'is-interacting' : ''}`}
        type="button"
        aria-label={`和${appearance?.name ?? 'AI 伙伴'}互动`}
        onClick={handleClick}
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={(event) => finishGesture(event)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="login-companion__frame" data-testid="login-companion-frame">
          <PartnerAppearance loadout={loadout} size="login" motion={motion} />
        </span>
      </button>
      <p className="login-companion__hint"><MessageCircle aria-hidden="true" size={13} />轻点互动 · 长按直接说话</p>
    </section>
  )
}
