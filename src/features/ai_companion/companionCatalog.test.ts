import { describe, expect, it } from 'vitest'
import type { CompanionLoadout } from '../../app/model'
import {
  buildCompanionPreviewLoadout,
  COMPANION_CATALOG,
  COMPANION_IDS,
  restoreDefaultCompanionLoadout,
} from './companionCatalog'
import { getCompanionAsset } from './companionAssets'

describe('primary companion catalog', () => {
  const equippedLoadout: CompanionLoadout = {
    owned: {
      appearance: ['momo', 'yunduo'],
      outfit: ['cloud-backpack'],
      decoration: ['cloud-flower-lamp'],
    },
    equipped: {
      appearance: 'yunduo',
      outfit: 'cloud-backpack',
      decoration: 'cloud-flower-lamp',
    },
    version: 4,
  }

  it('exposes exactly the four approved companion identities', () => {
    expect(COMPANION_IDS).toEqual(['momo', 'yunduo', 'cloudbloom', 'cloudbelle'])
    expect(COMPANION_CATALOG.filter((item) => item.category === 'appearance').map((item) => item.id))
      .toEqual(COMPANION_IDS)
  })

  it('maps each companion to a 2.5D manifest and a static loading fallback', () => {
    expect(getCompanionAsset('momo')).toMatchObject({
      fallbackImageUrl: '/pets/momo.png',
      frames: {},
    })
    expect(COMPANION_IDS.map((id) => getCompanionAsset(id).fallbackImageUrl)).toEqual([
      '/pets/momo.png',
      '/pets/yunduo.png',
      '/pets/cloudbloom.png',
      '/pets/cloudbelle.png',
    ])
  })

  it('contains only approved primary items and preserves the 70–80 percent demo ratio', () => {
    expect(COMPANION_CATALOG.map((item) => item.id)).toEqual([
      'momo', 'yunduo', 'cloudbloom', 'cloudbelle',
      'cloud-backpack', 'dawn-cloud-wand',
      'cloud-flower-lamp', 'rainbow-cloud-gate', 'flower-cloud-windchime', 'cloud-flower-chair',
    ])
    const remaining = COMPANION_CATALOG.filter((item) => item.id !== 'momo').reduce((sum, item) => sum + item.price, 0)
    expect(2000 / remaining).toBeGreaterThanOrEqual(.70)
    expect(2000 / remaining).toBeLessThanOrEqual(.80)
  })

  it('builds a non-persistent try-on loadout without granting ownership', () => {
    const item = COMPANION_CATALOG.find((entry) => entry.id === 'dawn-cloud-wand')!

    expect(buildCompanionPreviewLoadout(equippedLoadout, item)).toEqual({
      ...equippedLoadout,
      owned: equippedLoadout.owned,
      equipped: {
        appearance: 'yunduo',
        outfit: 'dawn-cloud-wand',
        decoration: 'cloud-flower-lamp',
      },
    })
    expect(equippedLoadout.owned.outfit).toEqual(['cloud-backpack'])
  })

  it('restores the default appearance while preserving everything the account owns', () => {
    expect(restoreDefaultCompanionLoadout(equippedLoadout)).toEqual({
      ...equippedLoadout,
      owned: equippedLoadout.owned,
      equipped: {
        appearance: 'momo',
        outfit: null,
        decoration: null,
      },
    })
  })
})
