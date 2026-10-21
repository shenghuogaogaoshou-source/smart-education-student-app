import { describe, expect, it } from 'vitest'
import { getCompanionAsset } from './companionAssets'
import { COMPANION_DIRECTIONS } from './render2d/types'

describe('2.5D companion asset manifests', () => {
  it('keeps the eight viewing directions in one stable clockwise order', () => {
    expect(COMPANION_DIRECTIONS).toEqual([
      'front', 'front-right', 'right', 'back-right',
      'back', 'back-left', 'left', 'front-left',
    ])
  })

  it.each(['momo', 'yunduo', 'cloudbloom', 'cloudbelle'] as const)(
    'registers all eight production views for %s',
    (companionId) => {
      const companion = getCompanionAsset(companionId)

      expect(Object.keys(companion.frames)).toHaveLength(8)
      expect(companion.frames.front?.layers.map((layer) => layer.name)).toEqual(
        expect.arrayContaining(['body', 'eyes', 'mouth']),
      )
      expect(companion.frames.back?.layers.map((layer) => layer.name)).not.toContain('mouth')
    },
  )

  it('keeps the approved still image as a failure fallback', () => {
    expect(getCompanionAsset('yunduo').fallbackImageUrl).toBe('/pets/yunduo.png')
  })
})
