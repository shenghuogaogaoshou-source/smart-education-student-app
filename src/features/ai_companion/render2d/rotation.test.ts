import { describe, expect, it } from 'vitest'
import { directionFromDrag, parallaxFromDrag } from './rotation'

describe('2.5D rotation math', () => {
  it('loops through all eight directions in the visual drag direction', () => {
    expect(directionFromDrag(0, 48, 44)).toBe('front-left')
    expect(directionFromDrag(0, -48, 44)).toBe('front-right')
    expect(directionFromDrag(7, 48, 44)).toBe('left')
    expect(directionFromDrag(0, 0, 44)).toBe('front')
  })

  it('clamps vertical drag to a subtle parallax instead of inventing a camera angle', () => {
    expect(parallaxFromDrag(999)).toEqual({ headY: 6, bodyY: 2, shadowScale: 0.96 })
    expect(parallaxFromDrag(-999)).toEqual({ headY: -6, bodyY: -2, shadowScale: 1.04 })
    expect(parallaxFromDrag(0)).toEqual({ headY: 0, bodyY: 0, shadowScale: 1 })
  })
})
