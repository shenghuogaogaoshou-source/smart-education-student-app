import type { CompanionMotion } from './types'

export type MotionStyle = {
  rootClass: string
  headClass?: string
  armLeftClass?: string
  armRightClass?: string
  mouthClass?: string
}

const MOTION_STYLES: Record<CompanionMotion, MotionStyle> = {
  idle: { rootClass: 'companion-motion--idle' },
  blink: { rootClass: 'companion-motion--blink' },
  wave: {
    rootClass: 'companion-motion--wave',
    armRightClass: 'companion-layer-motion--wave',
  },
  tilt: {
    rootClass: 'companion-motion--tilt',
    headClass: 'companion-layer-motion--tilt',
  },
  walk: { rootClass: 'companion-motion--walk' },
  listen: {
    rootClass: 'companion-motion--listen',
    headClass: 'companion-layer-motion--listen',
  },
  think: {
    rootClass: 'companion-motion--think',
    headClass: 'companion-layer-motion--think',
  },
  speak: {
    rootClass: 'companion-motion--speak',
    mouthClass: 'companion-layer-motion--speak',
  },
  celebrate: { rootClass: 'companion-motion--celebrate' },
}

export function resolveMotionStyle(motion: CompanionMotion, reduceMotion: boolean): MotionStyle {
  if (!reduceMotion) return MOTION_STYLES[motion]
  if (motion !== 'idle' && motion !== 'blink') {
    return { rootClass: 'companion-motion--reduced' }
  }
  return {
    rootClass: `${MOTION_STYLES[motion].rootClass} companion-motion--reduced`,
  }
}
