import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { CompanionLoadout } from '../../../app/model'
import { COMPANION_IDS, DEFAULT_COMPANION_ID, type CompanionId } from '../companionCatalog'
import { getCompanionAsset } from '../companionAssets'
import { Companion2DRenderer } from './Companion2DRenderer'
import { directionFromDrag, parallaxFromDrag } from './rotation'
import {
  COMPANION_DIRECTIONS,
  type CompanionDirection,
  type CompanionMotion,
  type CompanionScene,
} from './types'

type CompanionRotatorProps = {
  loadout: CompanionLoadout
  scene: Extract<CompanionScene, 'mall' | 'chat'>
  initialDirection?: CompanionDirection
  motion?: CompanionMotion
  reduceMotion?: boolean
  onDirectionChange?: (direction: CompanionDirection) => void
}

type PointerSession = {
  id: number
  startX: number
  startY: number
  startIndex: number
  dragged: boolean
}

function wrapIndex(index: number) {
  return ((index % COMPANION_DIRECTIONS.length) + COMPANION_DIRECTIONS.length) % COMPANION_DIRECTIONS.length
}

function companionIdFrom(loadout: CompanionLoadout): CompanionId {
  const candidate = loadout.equipped.appearance
  return typeof candidate === 'string' && (COMPANION_IDS as readonly string[]).includes(candidate)
    ? candidate as CompanionId
    : DEFAULT_COMPANION_ID
}

function adjacentFrameUrls(loadout: CompanionLoadout, direction: CompanionDirection) {
  const manifest = getCompanionAsset(companionIdFrom(loadout))
  const index = COMPANION_DIRECTIONS.indexOf(direction)
  const directions = [
    COMPANION_DIRECTIONS[wrapIndex(index - 1)],
    direction,
    COMPANION_DIRECTIONS[wrapIndex(index + 1)],
  ]
  const urls = directions.flatMap((candidate) => (
    manifest.frames[candidate]?.layers.map((layer) => layer.url) ?? []
  ))
  return urls.length > 0 ? [...new Set(urls)] : [manifest.fallbackImageUrl]
}

export function CompanionRotator({
  loadout,
  scene,
  initialDirection = 'front',
  motion = 'idle',
  reduceMotion = false,
  onDirectionChange,
}: CompanionRotatorProps) {
  const [direction, setDirection] = useState<CompanionDirection>(initialDirection)
  const [parallax, setParallax] = useState(() => parallaxFromDrag(0))
  const pointer = useRef<PointerSession | null>(null)
  const reportedDirection = useRef<CompanionDirection>(initialDirection)
  const preloadUrls = useMemo(() => adjacentFrameUrls(loadout, direction), [direction, loadout])

  useEffect(() => {
    const images = preloadUrls.map((url) => {
      const image = new Image()
      image.src = url
      return image
    })
    return () => images.forEach((image) => { image.src = '' })
  }, [preloadUrls])

  useEffect(() => {
    if (reportedDirection.current === direction) return
    reportedDirection.current = direction
    onDirectionChange?.(direction)
  }, [direction, onDirectionChange])

  const updateDirection = (next: CompanionDirection) => {
    setDirection((current) => current === next ? current : next)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const startIndex = COMPANION_DIRECTIONS.indexOf(direction)
    pointer.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIndex,
      dragged: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const session = pointer.current
    if (!session || session.id !== event.pointerId) return
    const deltaX = event.clientX - session.startX
    const deltaY = event.clientY - session.startY
    if (Math.hypot(deltaX, deltaY) <= 8) return
    session.dragged = true
    updateDirection(directionFromDrag(session.startIndex, deltaX, 44))
    setParallax(parallaxFromDrag(deltaY))
    event.preventDefault()
  }

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    const session = pointer.current
    if (!session || session.id !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointer.current = null
    setParallax(parallaxFromDrag(0))
  }

  const turn = (step: -1 | 1) => {
    const currentIndex = COMPANION_DIRECTIONS.indexOf(direction)
    updateDirection(COMPANION_DIRECTIONS[wrapIndex(currentIndex + step)])
  }

  const stageStyle = {
    '--companion-head-y': `${parallax.headY}px`,
    '--companion-body-y': `${parallax.bodyY}px`,
    '--companion-shadow-scale': parallax.shadowScale,
  } as CSSProperties

  return (
    <div className={`companion-rotator companion-rotator--${scene}`} data-direction={direction}>
      <div
        className="companion-rotator__stage"
        data-testid="companion-rotator-stage"
        style={stageStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <Companion2DRenderer
          loadout={loadout}
          scene={scene}
          direction={direction}
          motion={motion}
          reduceMotion={reduceMotion}
        />
      </div>
      <div className="companion-rotator__controls" aria-label="伙伴转动控制">
        <button type="button" onClick={() => turn(-1)} aria-label="向左转动伙伴">‹</button>
        <span aria-live="polite">{COMPANION_DIRECTIONS.indexOf(direction) + 1} / 8</span>
        <button type="button" onClick={() => turn(1)} aria-label="向右转动伙伴">›</button>
      </div>
    </div>
  )
}
