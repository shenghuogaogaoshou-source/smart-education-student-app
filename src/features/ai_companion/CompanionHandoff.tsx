import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { CompanionLoadout } from '../../app/model'
import { PartnerAppearance } from './PartnerAppearance'
import type { CompanionMotion } from './render2d/types'

export const HANDOFF_DURATION_MS = 1320

export type HandoffRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type HandoffSnapshot = {
  companionId: string
  loadoutVersion: number
  startRect: HandoffRect
  target: 'floating'
}

export type HandoffFrame = {
  progress: number
  motion: Extract<CompanionMotion, 'idle' | 'wave' | 'walk'>
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotate: 0
  opacity: number
}

type FloatingBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type FrameRect = {
  left: number
  top: number
  right?: number
  bottom?: number
  width: number
  height: number
}

type SafeArea = {
  top: number
  right: number
  bottom: number
  left: number
}

type CompanionSize = {
  width: number
  height: number
}

const COMPANION_EDGE_GAP = 8

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function frame(start: HandoffRect, end: HandoffRect, progress: number, motion: HandoffFrame['motion']): HandoffFrame {
  const scaleX = end.width / start.width
  const scaleY = end.height / start.height
  return {
    progress,
    motion,
    x: end.left - start.left,
    y: end.top - start.top,
    scaleX: interpolate(1, scaleX, progress),
    scaleY: interpolate(1, scaleY, progress),
    rotate: 0,
    opacity: interpolate(1, .92, progress),
  }
}

export function buildHandoffTimeline(start: HandoffRect, end: HandoffRect, reducedMotion: boolean): HandoffFrame[] {
  if (reducedMotion) {
    return [frame(start, end, 0, 'idle'), frame(start, end, 1, 'idle')]
  }
  return [
    frame(start, end, 0, 'idle'),
    frame(start, end, .18, 'wave'),
    frame(start, end, .38, 'walk'),
    frame(start, end, 1, 'idle'),
  ]
}

export function calculateFloatingBounds(
  frameRect: FrameRect,
  navigation: { height: number },
  safeArea: SafeArea,
  companionSize: number,
): FloatingBounds {
  const width = Math.max(1, frameRect.width)
  const height = Math.max(1, frameRect.height)
  const radius = companionSize / 2
  const horizontalInset = radius + COMPANION_EDGE_GAP
  const verticalInset = radius + COMPANION_EDGE_GAP

  const minX = (safeArea.left + horizontalInset) / width
  const maxX = 1 - (safeArea.right + horizontalInset) / width
  const minY = (safeArea.top + verticalInset) / height
  const maxY = 1 - (safeArea.bottom + navigation.height + verticalInset) / height

  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  }
}

export function calculateMapCompanionAnchor(
  nodeRect: FrameRect,
  companionSize: CompanionSize,
  viewport: FrameRect,
) {
  const bottom = nodeRect.top - COMPANION_EDGE_GAP
  return {
    left: Math.max(
      viewport.left,
      Math.min(nodeRect.left + nodeRect.width / 2 - companionSize.width / 2, viewport.left + viewport.width - companionSize.width),
    ),
    top: Math.max(viewport.top, bottom - companionSize.height),
    width: companionSize.width,
    height: companionSize.height,
    bottom,
  }
}

type CompanionHandoffProps = {
  loadout: CompanionLoadout
  startRect: HandoffRect
  endRect: HandoffRect
  onComplete: () => void
}

export function CompanionHandoff({ loadout, startRect, endRect, onComplete }: CompanionHandoffProps) {
  const timeline = useMemo(
    () => buildHandoffTimeline(startRect, endRect, false),
    [endRect.bottom, endRect.height, endRect.left, endRect.top, endRect.width, startRect.height, startRect.left, startRect.top, startRect.width],
  )
  const [frameIndex, setFrameIndex] = useState(0)
  const current = timeline[frameIndex]

  useEffect(() => {
    const timers = timeline.slice(1).map((keyframe, index) => window.setTimeout(
      () => setFrameIndex(index + 1),
      keyframe.progress * HANDOFF_DURATION_MS,
    ))
    const completeTimer = window.setTimeout(onComplete, HANDOFF_DURATION_MS)
    return () => {
      timers.forEach(window.clearTimeout)
      window.clearTimeout(completeTimer)
    }
  }, [onComplete, timeline])

  const style = {
    left: `${startRect.left}px`,
    top: `${startRect.top}px`,
    width: `${startRect.width}px`,
    height: `${startRect.height}px`,
    '--handoff-dx': `${timeline.at(-1)?.x ?? current.x}px`,
    '--handoff-dy': `${timeline.at(-1)?.y ?? current.y}px`,
    '--handoff-scale-x': timeline.at(-1)?.scaleX ?? current.scaleX,
    '--handoff-scale-y': timeline.at(-1)?.scaleY ?? current.scaleY,
    '--handoff-wave-x': `${timeline[1]?.x ?? 0}px`,
    '--handoff-wave-y': `${timeline[1]?.y ?? 0}px`,
    '--handoff-wave-scale-x': timeline[1]?.scaleX ?? 1,
    '--handoff-wave-scale-y': timeline[1]?.scaleY ?? 1,
    '--handoff-walk-x': `${timeline[2]?.x ?? timeline.at(-1)?.x ?? 0}px`,
    '--handoff-walk-y': `${timeline[2]?.y ?? timeline.at(-1)?.y ?? 0}px`,
    '--handoff-walk-scale-x': timeline[2]?.scaleX ?? timeline.at(-1)?.scaleX ?? 1,
    '--handoff-walk-scale-y': timeline[2]?.scaleY ?? timeline.at(-1)?.scaleY ?? 1,
    '--handoff-opacity': current.opacity,
    '--handoff-duration': `${HANDOFF_DURATION_MS}ms`,
  } as CSSProperties

  return (
    <div
      className="companion-handoff"
      data-testid="companion-handoff"
      data-handoff-status="running"
      data-handoff-motion={current.motion}
      style={style}
      aria-hidden="true"
    >
      <PartnerAppearance loadout={loadout} size="floating" motion={current.motion} />
    </div>
  )
}
