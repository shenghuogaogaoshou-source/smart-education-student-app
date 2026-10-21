import { describe, expect, it } from 'vitest'
import { COMPANION_IDS } from './companionCatalog'
import { resolveAttachmentFrame } from './attachments'

describe('2.5D companion attachment frames', () => {
  it('changes backpack occlusion when the companion turns around', () => {
    expect(resolveAttachmentFrame('momo', 'cloud-backpack', 'front')?.layer).toBe('behind')
    expect(resolveAttachmentFrame('momo', 'cloud-backpack', 'back')?.layer).toBe('front')
  })

  it('uses companion-specific placement instead of one shared overlay', () => {
    expect(resolveAttachmentFrame('yunduo', 'cloud-backpack', 'right'))
      .not.toEqual(resolveAttachmentFrame('momo', 'cloud-backpack', 'right'))
  })

  it('keeps room decorations behind the companion body', () => {
    for (const companionId of COMPANION_IDS) {
      expect(resolveAttachmentFrame(companionId, 'cloud-flower-lamp', 'front')?.layer).toBe('behind')
      expect(resolveAttachmentFrame(companionId, 'rainbow-cloud-gate', 'front')?.layer).toBe('behind')
      expect(resolveAttachmentFrame(companionId, 'flower-cloud-windchime', 'front')?.layer).toBe('behind')
      expect(resolveAttachmentFrame(companionId, 'cloud-flower-chair', 'front')?.layer).toBe('behind')
    }
  })

  it('sizes wearable and scene items independently instead of covering the whole companion', () => {
    expect(resolveAttachmentFrame('momo', 'cloud-backpack', 'front')?.scale).toBeLessThanOrEqual(0.52)
    expect(resolveAttachmentFrame('momo', 'dawn-cloud-wand', 'front')?.scale).toBeLessThanOrEqual(0.36)
    expect(resolveAttachmentFrame('momo', 'dawn-cloud-wand', 'front')?.offset.x).toBeGreaterThan(28)
    expect(resolveAttachmentFrame('momo', 'dawn-cloud-wand', 'front')?.offset.x).toBeLessThan(36)
    expect(resolveAttachmentFrame('momo', 'cloud-flower-lamp', 'front')?.offset.x).toBeGreaterThan(10)
    expect(resolveAttachmentFrame('momo', 'flower-cloud-windchime', 'front')?.offset.x).toBeLessThan(-10)
    expect(resolveAttachmentFrame('momo', 'cloud-flower-chair', 'front')?.offset.y).toBeGreaterThan(12)
  })

  it('returns null for an item that is not a supported attachment', () => {
    expect(resolveAttachmentFrame('cloudbelle', 'not-a-real-item', 'front')).toBeNull()
    expect(resolveAttachmentFrame('cloudbelle', 'momo', 'front')).toBeNull()
  })
})
