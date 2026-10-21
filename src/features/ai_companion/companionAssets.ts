import type { CompanionId } from './companionCatalog'
import type {
  Companion2DAssetManifest,
  CompanionDirection,
  CompanionDirectionFrame,
  CompanionLayerName,
} from './render2d/types'

export type CompanionAssetManifest = Companion2DAssetManifest & { id: CompanionId }

function momoFrame(
  direction: CompanionDirection,
  visualBounds: CompanionDirectionFrame['visualBounds'],
  faceLayers = false,
): CompanionDirectionFrame {
  const layerNames: CompanionLayerName[] = faceLayers
    ? ['body', 'head', 'eyes', 'mouth']
    : ['body', 'head']
  return {
    direction,
    canvas: { width: 1024, height: 1024 },
    origin: {
      x: visualBounds.x + visualBounds.width / 2,
      y: visualBounds.y + visualBounds.height,
    },
    visualBounds,
    layers: layerNames.map((name) => ({
      name,
      url: `/companions-2d/momo/${direction}/${name}.webp`,
    })),
  }
}

function companionFrame(
  companionId: Exclude<CompanionId, 'momo'>,
  direction: CompanionDirection,
  faceLayers = false,
): CompanionDirectionFrame {
  const visualBounds = { x: 48, y: 32, width: 928, height: 928 }
  return {
    direction,
    canvas: { width: 1024, height: 1024 },
    origin: { x: 512, y: 960 },
    visualBounds,
    layers: [
      {
        name: 'body',
        url: `/companions-2d/${companionId}/${direction}/body.webp`,
      },
      ...(faceLayers
        ? [
            { name: 'eyes' as const, url: `/companions-2d/${companionId}/${direction}/eyes.webp` },
            { name: 'mouth' as const, url: `/companions-2d/${companionId}/${direction}/mouth.webp` },
          ]
        : []),
    ],
  }
}

const MOMO_FRAMES: CompanionAssetManifest['frames'] = {
  front: momoFrame('front', { x: 224, y: 50, width: 672, height: 974 }, true),
  'front-right': momoFrame('front-right', { x: 234, y: 60, width: 662, height: 964 }, true),
  right: momoFrame('right', { x: 264, y: 55, width: 572, height: 969 }),
  'back-right': momoFrame('back-right', { x: 166, y: 60, width: 670, height: 964 }),
  back: momoFrame('back', { x: 250, y: 10, width: 646, height: 950 }),
  'back-left': momoFrame('back-left', { x: 249, y: 20, width: 647, height: 939 }),
  left: momoFrame('left', { x: 196, y: 18, width: 578, height: 945 }),
  'front-left': momoFrame('front-left', { x: 128, y: 20, width: 687, height: 945 }, true),
}

function fullCompanionFrames(companionId: Exclude<CompanionId, 'momo'>): CompanionAssetManifest['frames'] {
  return Object.fromEntries(
    (Object.keys(MOMO_FRAMES) as CompanionDirection[]).map((direction) => [
      direction,
      companionFrame(companionId, direction, direction === 'front'),
    ]),
  ) as CompanionAssetManifest['frames']
}

const COMPANION_ASSETS: Record<CompanionId, CompanionAssetManifest> = {
  momo: {
    id: 'momo',
    fallbackImageUrl: '/pets/momo.png',
    frames: MOMO_FRAMES,
  },
  yunduo: {
    id: 'yunduo',
    fallbackImageUrl: '/pets/yunduo.png',
    frames: fullCompanionFrames('yunduo'),
  },
  cloudbloom: {
    id: 'cloudbloom',
    fallbackImageUrl: '/pets/cloudbloom.png',
    frames: fullCompanionFrames('cloudbloom'),
  },
  cloudbelle: {
    id: 'cloudbelle',
    fallbackImageUrl: '/pets/cloudbelle.png',
    frames: fullCompanionFrames('cloudbelle'),
  },
}

export function getCompanionAsset(id: CompanionId): CompanionAssetManifest {
  return COMPANION_ASSETS[id]
}
