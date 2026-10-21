import { describe, expect, it } from 'vitest'
import { resolveMotionStyle } from './motion'

describe('resolveMotionStyle', () => {
  it('targets the visible arm and mouth layers for expressive motion', () => {
    expect(resolveMotionStyle('wave', false)).toEqual({
      rootClass: 'companion-motion--wave',
      armRightClass: 'companion-layer-motion--wave',
    })
    expect(resolveMotionStyle('speak', false)).toEqual({
      rootClass: 'companion-motion--speak',
      mouthClass: 'companion-layer-motion--speak',
    })
  })

  it('removes travel and secondary movement when reduced motion is requested', () => {
    expect(resolveMotionStyle('walk', true)).toEqual({
      rootClass: 'companion-motion--reduced',
    })
    expect(resolveMotionStyle('blink', true)).toEqual({
      rootClass: 'companion-motion--blink companion-motion--reduced',
    })
  })
})
