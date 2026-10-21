import type { CompanionId } from './companionCatalog'
import type { CompanionDirection } from './render2d/types'

export const ATTACHMENT_IDS = [
  'cloud-backpack',
  'dawn-cloud-wand',
  'cloud-flower-lamp',
  'rainbow-cloud-gate',
  'flower-cloud-windchime',
  'cloud-flower-chair',
] as const

export type AttachmentId = (typeof ATTACHMENT_IDS)[number]
export type AttachmentDisplayLayer = 'behind' | 'body' | 'front'

export type AttachmentFrame = {
  itemId: AttachmentId
  direction: CompanionDirection
  url: string
  layer: AttachmentDisplayLayer
  anchor: 'back' | 'hand-right' | 'scene'
  offset: { x: number; y: number }
  scale: number
  rotation: number
}

type AttachmentFit = Pick<AttachmentFrame, 'offset' | 'scale' | 'rotation'>

const COMPANION_FITS: Record<CompanionId, AttachmentFit> = {
  momo: { offset: { x: 0, y: 0 }, scale: 1, rotation: 0 },
  yunduo: { offset: { x: -2, y: 3 }, scale: 0.94, rotation: -1 },
  cloudbloom: { offset: { x: 3, y: -1 }, scale: 0.92, rotation: 1 },
  cloudbelle: { offset: { x: 1, y: 2 }, scale: 0.96, rotation: 0 },
}

const ITEM_FITS: Record<AttachmentId, AttachmentFit> = {
  'cloud-backpack': { offset: { x: 0, y: 5 }, scale: 0.46, rotation: 0 },
  'dawn-cloud-wand': { offset: { x: 32, y: 15 }, scale: 0.34, rotation: 0 },
  'cloud-flower-lamp': { offset: { x: 24, y: 2 }, scale: 0.62, rotation: 0 },
  'rainbow-cloud-gate': { offset: { x: 0, y: 4 }, scale: 0.86, rotation: 0 },
  'flower-cloud-windchime': { offset: { x: -25, y: 1 }, scale: 0.6, rotation: 0 },
  'cloud-flower-chair': { offset: { x: -10, y: 16 }, scale: 0.82, rotation: 0 },
}

const BODY_ITEMS = new Set<AttachmentId>(['cloud-backpack', 'dawn-cloud-wand'])

function isAttachmentId(itemId: string): itemId is AttachmentId {
  return (ATTACHMENT_IDS as readonly string[]).includes(itemId)
}

function resolveLayer(itemId: AttachmentId, direction: CompanionDirection): AttachmentDisplayLayer {
  if (itemId !== 'cloud-backpack') return BODY_ITEMS.has(itemId) ? 'front' : 'behind'
  if (direction === 'back' || direction === 'back-left' || direction === 'back-right') return 'front'
  if (direction === 'left' || direction === 'right') return 'body'
  return 'behind'
}

function resolveAnchor(itemId: AttachmentId): AttachmentFrame['anchor'] {
  if (itemId === 'cloud-backpack') return 'back'
  if (itemId === 'dawn-cloud-wand') return 'hand-right'
  return 'scene'
}

export function resolveAttachmentFrame(
  companionId: CompanionId,
  itemId: string,
  direction: CompanionDirection,
): AttachmentFrame | null {
  if (!isAttachmentId(itemId)) return null
  const companionFit = COMPANION_FITS[companionId]
  const itemFit = ITEM_FITS[itemId]
  return {
    itemId,
    direction,
    url: `/companions-2d/attachments/${itemId}/${direction}.webp`,
    layer: resolveLayer(itemId, direction),
    anchor: resolveAnchor(itemId),
    offset: {
      x: companionFit.offset.x + itemFit.offset.x,
      y: companionFit.offset.y + itemFit.offset.y,
    },
    scale: companionFit.scale * itemFit.scale,
    rotation: companionFit.rotation + itemFit.rotation,
  }
}
