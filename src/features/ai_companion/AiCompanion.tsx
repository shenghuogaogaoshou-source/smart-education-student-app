import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppState } from '../../app/AppState'
import { AiPanel } from './AiPanel'
import { startSpeechCapture, speakCompanionReply } from './browserSpeech'
import { requestCompanionReply } from './companionChat'
import { getCompanionItem } from './companionCatalog'
import { CompanionBubble } from './CompanionBubble'
import {
  CompanionHandoff,
  calculateFloatingBounds,
  calculateMapCompanionAnchor,
  type HandoffRect,
  type HandoffSnapshot,
} from './CompanionHandoff'
import { createConversationController, motionForConversationStatus } from './conversation/conversationMachine'
import { selectCompanionAction, type CompanionActionScene } from './interaction/actionSelector'
import { createGestureMachine } from './interaction/gestureMachine'
import { LOGIN_COMPANION_HANDOFF_KEY } from './LoginCompanion'
import { PartnerAppearance } from './PartnerAppearance'
import type { CompanionMotion } from './render2d/types'
import './ai-companion.css'

const LONG_PRESS_MS = 600
const BOTTOM_NAV_HEIGHT = 72
const BOTTOM_SAFE_SPACE = 7
const COMPANION_SIZE = 78
const MAP_ROUTE_DURATION_MS = 820

type MapTarget = {
  id: string
  x: number
  y: number
  anchor?: HTMLElement | null
}

type AiCompanionProps = {
  placement?: 'floating' | 'test-map'
  mapTarget?: MapTarget
  scene?: Exclude<CompanionActionScene, 'login' | 'test-map'>
}

type AppFrameBounds = {
  left: number
  top: number
  width: number
  height: number
}

type HandoffRecord = HandoffSnapshot & { version: 3 }

type ActiveHandoff = {
  start: HandoffRect
  end: HandoffRect
}

function hasValidRect(rect: unknown): rect is HandoffRect {
  if (!rect || typeof rect !== 'object') return false
  const candidate = rect as Partial<HandoffRect>
  return ['left', 'top', 'right', 'bottom', 'width', 'height'].every((key) => Number.isFinite(candidate[key as keyof HandoffRect]))
    && Number(candidate.width) > 0
    && Number(candidate.height) > 0
}

function readHandoffRecord(companionId: string, loadoutVersion: number): HandoffRecord | null {
  const raw = sessionStorage.getItem(LOGIN_COMPANION_HANDOFF_KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<HandoffRecord> | null
    if (
      !value
      || value.version !== 3
      || value.companionId !== companionId
      || value.loadoutVersion !== loadoutVersion
      || value.target !== 'floating'
      || getCompanionItem(value.companionId)?.category !== 'appearance'
      || !hasValidRect(value.startRect)
    ) {
      return null
    }
    return value as HandoffRecord
  } catch {
    return null
  }
}

function toHandoffRect(rect: DOMRect): HandoffRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function getAppFrameBounds(): AppFrameBounds | null {
  const frame = document.querySelector<HTMLElement>('.app-frame')
  if (!frame) return null
  const rect = frame.getBoundingClientRect()
  const visibleLeft = Math.max(0, rect.left)
  const visibleTop = Math.max(0, rect.top)
  const visibleRight = Math.min(window.innerWidth, rect.right)
  const visibleBottom = Math.min(window.innerHeight, rect.bottom)
  const visibleWidth = visibleRight - visibleLeft
  const visibleHeight = visibleBottom - visibleTop
  if (visibleWidth <= 0 || visibleHeight <= 0) return null
  return { left: visibleLeft, top: visibleTop, width: visibleWidth, height: visibleHeight }
}

function keepPositionInsideFrame(position: { x: number; y: number }, bounds: AppFrameBounds) {
  const limits = calculateFloatingBounds(
    bounds,
    { height: BOTTOM_NAV_HEIGHT },
    { top: 0, right: 0, bottom: BOTTOM_SAFE_SPACE, left: 0 },
    COMPANION_SIZE,
  )
  return {
    x: Math.min(limits.maxX, Math.max(limits.minX, position.x)),
    y: Math.min(limits.maxY, Math.max(limits.minY, position.y)),
  }
}

export function AiCompanion({ placement = 'floating', mapTarget, scene = 'home' }: AiCompanionProps) {
  const { state, setAiPosition } = useAppState()
  const [open, setOpen] = useState(false)
  const [dragPosition, setDragPosition] = useState(state.aiPosition)
  const [handoff, setHandoff] = useState<ActiveHandoff | null>(null)
  const [mapPosition, setMapPosition] = useState<{ left: number; top: number } | null>(null)
  const [reactionMessage, setReactionMessage] = useState('')
  const [reactionVisible, setReactionVisible] = useState(false)
  const [interactionMotion, setInteractionMotion] = useState<CompanionMotion>('idle')
  const [routeMoving, setRouteMoving] = useState(false)
  const [appFrameBounds, setAppFrameBounds] = useState<AppFrameBounds | null>(null)
  const controlRef = useRef<HTMLButtonElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handoffStartedRef = useRef(false)
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousMapTargetRef = useRef(mapTarget?.id)
  const pendingPositionRef = useRef(dragPosition)
  const gestureRef = useRef(createGestureMachine({ longPressMs: LONG_PRESS_MS, moveThreshold: 8 }))
  const recentActionsRef = useRef<string[]>([])
  const suppressClickRef = useRef(false)
  const loadout = state.companion
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

  const measureAppFrame = useCallback(() => {
    setAppFrameBounds(getAppFrameBounds())
  }, [])

  useLayoutEffect(() => {
    if (placement === 'test-map') return
    measureAppFrame()
    window.addEventListener('resize', measureAppFrame)
    window.addEventListener('scroll', measureAppFrame, true)
    return () => {
      window.removeEventListener('resize', measureAppFrame)
      window.removeEventListener('scroll', measureAppFrame, true)
    }
  }, [measureAppFrame, placement])

  useLayoutEffect(() => {
    if (placement !== 'test-map' || !mapTarget?.anchor) {
      setMapPosition(null)
      return
    }

    const measureAnchor = () => {
      const anchor = mapTarget.anchor
      const viewport = anchor?.closest<HTMLElement>('.test-route-canvas')
      if (!anchor || !viewport) {
        setMapPosition(null)
        return
      }
      const nodeRect = anchor.getBoundingClientRect()
      const viewportRect = viewport.getBoundingClientRect()
      if (nodeRect.width <= 0 || nodeRect.height <= 0 || viewportRect.width <= 0 || viewportRect.height <= 0) {
        setMapPosition(null)
        return
      }
      const anchored = calculateMapCompanionAnchor(nodeRect, { width: 64, height: 64 }, viewportRect)
      setMapPosition({
        left: anchored.left - viewportRect.left,
        top: anchored.top - viewportRect.top,
      })
    }

    measureAnchor()
    window.addEventListener('resize', measureAnchor)
    return () => window.removeEventListener('resize', measureAnchor)
  }, [mapTarget?.anchor, mapTarget?.id, placement])

  useLayoutEffect(() => {
    if (placement === 'test-map') {
      handoffStartedRef.current = true
      sessionStorage.removeItem(LOGIN_COMPANION_HANDOFF_KEY)
      return
    }
    if (handoffStartedRef.current) return
    const companionId = loadout.equipped.appearance ?? 'momo'
    const record = readHandoffRecord(companionId, loadout.version)
    if (!record) {
      handoffStartedRef.current = true
      sessionStorage.removeItem(LOGIN_COMPANION_HANDOFF_KEY)
      return
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reducedMotion) {
      handoffStartedRef.current = true
      sessionStorage.removeItem(LOGIN_COMPANION_HANDOFF_KEY)
      return
    }
    if (!appFrameBounds) return

    handoffStartedRef.current = true
    const targetRect = controlRef.current?.getBoundingClientRect()
    if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
      sessionStorage.removeItem(LOGIN_COMPANION_HANDOFF_KEY)
      return
    }

    setHandoff({
      start: record.startRect,
      end: toHandoffRect(targetRect),
    })
  }, [appFrameBounds, placement, loadout.equipped.appearance, loadout.version])

  useEffect(() => {
    const previousId = previousMapTargetRef.current
    previousMapTargetRef.current = mapTarget?.id
    if (placement !== 'test-map' || !previousId || !mapTarget?.id || previousId === mapTarget.id) return

    setRouteMoving(true)
    if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current)
    routeTimerRef.current = window.setTimeout(() => setRouteMoving(false), MAP_ROUTE_DURATION_MS)
    return () => {
      if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current)
    }
  }, [mapTarget?.id, placement])

  useEffect(() => {
    const unsubscribe = conversationController.subscribe(setConversation)
    return () => {
      unsubscribe()
      conversationController.cancel()
      if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current)
      if (interactionTimerRef.current) window.clearTimeout(interactionTimerRef.current)
    }
  }, [conversationController])

  const showPageReaction = useCallback(() => {
    conversationController.cancel()
    const reactionScene = placement === 'test-map' ? 'test-map' : scene
    const reaction = selectCompanionAction({
      scene: reactionScene,
      recentActions: recentActionsRef.current,
      progress: 0,
    })
    recentActionsRef.current = [reaction.reactionId]
    setReactionMessage(reaction.message)
    setReactionVisible(true)
    setInteractionMotion(reaction.motion)
    if (interactionTimerRef.current) window.clearTimeout(interactionTimerRef.current)
    interactionTimerRef.current = window.setTimeout(() => {
      setInteractionMotion('idle')
    }, 720)
  }, [conversationController, placement, scene])

  const handleTap = useCallback(() => {
    if (placement === 'floating' && reactionVisible) {
      setReactionVisible(false)
      setReactionMessage('')
      setInteractionMotion('idle')
      setOpen(true)
      return
    }
    showPageReaction()
  }, [placement, reactionVisible, showPageReaction])

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Dragging and long-press remain usable in WebViews without pointer capture.
    }
    gestureRef.current.send({ type: 'down', x: event.clientX, y: event.clientY, at: Date.now() })
    timerRef.current = setTimeout(() => {
      const result = gestureRef.current.send({ type: 'tick', at: Date.now() })
      if (result?.kind === 'long-press') {
        suppressClickRef.current = true
        setReactionVisible(false)
        setReactionMessage('')
        setInteractionMotion('idle')
        conversationController.start()
      }
    }, LONG_PRESS_MS)
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const result = gestureRef.current.send({ type: 'move', x: event.clientX, y: event.clientY, at: Date.now() })
    if (result?.kind !== 'drag-start' && result?.kind !== 'drag') return
    if (result.kind === 'drag-start' && timerRef.current) clearTimeout(timerRef.current)
    suppressClickRef.current = true
    if (placement === 'test-map') return
    const bounds = appFrameBounds ?? getAppFrameBounds()
    if (!bounds) return
    const nextPosition = keepPositionInsideFrame({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }, bounds)
    pendingPositionRef.current = nextPosition
    setDragPosition(nextPosition)
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const result = gestureRef.current.send({ type: 'up', x: event.clientX, y: event.clientY, at: Date.now() })
    if (result?.kind === 'long-press-end') conversationController.stop()
    if (result?.kind === 'tap') {
      suppressClickRef.current = true
      handleTap()
    }
    if (result?.kind === 'drag-end' && placement === 'floating') {
      const currentPosition = pendingPositionRef.current
      const bounds = appFrameBounds ?? getAppFrameBounds()
      const snapped = bounds
        ? keepPositionInsideFrame({ ...currentPosition, x: currentPosition.x < .5 ? 0 : 1 }, bounds)
        : currentPosition
      setDragPosition(snapped)
      setAiPosition(snapped)
    }
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Ignore incomplete pointer capture implementations.
    }
  }

  function pointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const result = gestureRef.current.send({ type: 'cancel', at: Date.now() })
    if (result?.kind === 'cancel') {
      suppressClickRef.current = true
      conversationController.cancel()
    }
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Ignore incomplete pointer capture implementations.
    }
  }

  function click() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    handleTap()
  }

  const safePosition = appFrameBounds ? keepPositionInsideFrame(dragPosition, appFrameBounds) : null
  const floatingPositionStyle = safePosition && appFrameBounds ? {
    left: `${appFrameBounds.left + safePosition.x * appFrameBounds.width}px`,
    top: `${appFrameBounds.top + safePosition.y * appFrameBounds.height}px`,
  } as CSSProperties : {
    left: '88vw',
    top: '78vh',
  } as CSSProperties
  const positionStyle = placement === 'test-map'
    ? mapPosition
      ? {
          left: `${mapPosition.left}px`,
          top: `${mapPosition.top}px`,
          width: '64px',
          height: '64px',
        } as CSSProperties
      : mapTarget
        ? { left: `${mapTarget.x}%`, bottom: `${mapTarget.y}%` } as CSSProperties
        : floatingPositionStyle
    : floatingPositionStyle
  const isOnRightSide = placement === 'test-map'
    ? mapPosition
      ? mapPosition.left > 175
      : (mapTarget?.x ?? 50) > 50
    : dragPosition.x > .5
  const completeHandoff = useCallback(() => {
    sessionStorage.removeItem(LOGIN_COMPANION_HANDOFF_KEY)
    setHandoff(null)
  }, [])
  const bubbleMessage = conversation.status === 'transcribing'
    ? conversation.interimText
    : conversation.reply || reactionMessage
  const bubbleState = conversation.status === 'idle' && !conversation.reply ? 'idle' : conversation.status
  const currentMotion = routeMoving
    ? 'run'
    : conversation.status === 'idle'
      ? interactionMotion
      : motionForConversationStatus(conversation.status)

  return (
    <>
      <button
        ref={controlRef}
        className={`ai-companion-control ai-companion-control--${placement} ${isOnRightSide ? 'is-on-right-side' : 'is-on-left-side'} ${routeMoving ? 'is-route-moving' : ''} ${handoff ? 'is-handoff-target' : ''}`}
        type="button"
        aria-label="AI伙伴"
        data-companion-placement={placement}
        data-map-node-id={mapTarget?.id}
        style={positionStyle}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={click}
      >
        <PartnerAppearance loadout={loadout} size="floating" motion={currentMotion} interactive />
        <CompanionBubble state={bubbleState} message={bubbleMessage} className="ai-companion__bubble" />
      </button>

      {placement === 'floating' && handoff && (
        <CompanionHandoff
          loadout={loadout}
          startRect={handoff.start}
          endRect={handoff.end}
          onComplete={completeHandoff}
        />
      )}

      {open && <AiPanel onClose={() => setOpen(false)} />}
    </>
  )
}
