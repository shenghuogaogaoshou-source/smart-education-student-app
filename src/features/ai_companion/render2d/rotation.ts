import { COMPANION_DIRECTIONS, type CompanionDirection } from './types'

function wrapDirectionIndex(index: number) {
  const length = COMPANION_DIRECTIONS.length
  return ((index % length) + length) % length
}

export function directionFromDrag(
  startIndex: number,
  deltaX: number,
  pixelsPerStep: number,
): CompanionDirection {
  const safePixelsPerStep = Math.max(1, Math.abs(pixelsPerStep))
  const step = Math.round(deltaX / safePixelsPerStep)
  return COMPANION_DIRECTIONS[wrapDirectionIndex(startIndex - step)]
}

function tidy(value: number) {
  return Math.abs(value) < 0.0001 ? 0 : Number(value.toFixed(2))
}

export function parallaxFromDrag(deltaY: number) {
  const progress = Math.max(-1, Math.min(1, deltaY / 80))
  return {
    headY: tidy(progress * 6),
    bodyY: tidy(progress * 2),
    shadowScale: tidy(1 - progress * 0.04),
  }
}
