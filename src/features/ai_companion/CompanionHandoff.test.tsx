import { describe, expect, it } from 'vitest'
import {
  buildHandoffTimeline,
  calculateFloatingBounds,
  calculateMapCompanionAnchor,
  type HandoffRect,
} from './CompanionHandoff'

const start: HandoffRect = {
  left: 96,
  top: 120,
  right: 276,
  bottom: 300,
  width: 180,
  height: 180,
}

const end: HandoffRect = {
  left: 310,
  top: 620,
  right: 380,
  bottom: 690,
  width: 70,
  height: 70,
}

describe('companion handoff', () => {
  it('moves through idle, greeting and walking phases without spinning', () => {
    const timeline = buildHandoffTimeline(start, end, false)

    expect(timeline.map((frame) => frame.motion)).toEqual(['idle', 'wave', 'walk', 'idle'])
    expect(timeline.every((frame) => frame.rotate === 0)).toBe(true)
    expect(timeline.at(-1)?.scaleX).toBeCloseTo(70 / 180)
    expect(timeline.at(-1)?.scaleY).toBeCloseTo(70 / 180)
    expect(timeline.at(-1)).toMatchObject({ x: 214, y: 500 })
  })

  it('keeps only the start and end frames when reduced motion is requested', () => {
    expect(buildHandoffTimeline(start, end, true)).toHaveLength(2)
  })

  it('keeps the floating companion inside the frame above navigation and safe areas', () => {
    const bounds = calculateFloatingBounds(
      { left: 200, top: 0, width: 460, height: 1600 },
      { height: 72 },
      { top: 0, right: 0, bottom: 16, left: 0 },
      78,
    )

    expect(bounds.minX).toBeGreaterThan(0)
    expect(bounds.maxX).toBeLessThan(1)
    expect(bounds.maxY).toBeLessThan(1)
  })

  it('anchors the companion center eight pixels above the current level button', () => {
    const anchor = calculateMapCompanionAnchor(
      { left: 60, top: 400, right: 110, bottom: 450, width: 50, height: 50 },
      { width: 64, height: 64 },
      { left: 20, top: 100, width: 350, height: 900 },
    )

    expect(anchor).toEqual({
      left: 53,
      top: 328,
      width: 64,
      height: 64,
      bottom: 392,
    })
  })
})
