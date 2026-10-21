import type { CSSProperties, ReactNode } from 'react'
import type { CompanionCategory, CompanionLoadout } from '../../../app/model'
import {
  COMPANION_IDS,
  DEFAULT_COMPANION_ID,
  getCompanionItem,
  type CompanionId,
} from '../companionCatalog'
import { getCompanionAsset } from '../companionAssets'
import { resolveAttachmentFrame, type AttachmentDisplayLayer } from '../attachments'
import { resolveMotionStyle } from './motion'
import {
  COMPANION_DIRECTIONS,
  type CompanionDirection,
  type CompanionLayerName,
  type CompanionMotion,
  type CompanionScene,
} from './types'

const LAYER_ORDER: CompanionLayerName[] = [
  'shadow',
  'behind',
  'body',
  'head',
  'arm-left',
  'arm-right',
  'eyes',
  'mouth',
  'front',
]

type Companion2DRendererProps = {
  loadout: CompanionLoadout
  scene: CompanionScene
  direction?: CompanionDirection
  motion?: CompanionMotion
  interactive?: boolean
  reduceMotion?: boolean
}

function isCompanionId(value: string | null): value is CompanionId {
  return typeof value === 'string' && (COMPANION_IDS as readonly string[]).includes(value)
}

function circularDistance(from: number, to: number) {
  const direct = Math.abs(from - to)
  return Math.min(direct, COMPANION_DIRECTIONS.length - direct)
}

function resolveFrameDirection(
  companionId: CompanionId,
  requested: CompanionDirection,
): CompanionDirection {
  const frames = getCompanionAsset(companionId).frames
  if (frames[requested]) return requested

  const requestedIndex = COMPANION_DIRECTIONS.indexOf(requested)
  const available = COMPANION_DIRECTIONS.filter((direction) => frames[direction])
  if (available.length === 0) return 'front'
  return available.reduce((closest, candidate) => {
    const closestDistance = circularDistance(requestedIndex, COMPANION_DIRECTIONS.indexOf(closest))
    const candidateDistance = circularDistance(requestedIndex, COMPANION_DIRECTIONS.indexOf(candidate))
    return candidateDistance < closestDistance ? candidate : closest
  })
}

function layerMotionClass(layer: CompanionLayerName, style: ReturnType<typeof resolveMotionStyle>) {
  if (layer === 'head') return style.headClass
  if (layer === 'arm-left') return style.armLeftClass
  if (layer === 'arm-right') return style.armRightClass
  if (layer === 'mouth') return style.mouthClass
  return undefined
}

export function Companion2DRenderer({
  loadout,
  scene,
  direction = 'front',
  motion = 'idle',
  interactive = false,
  reduceMotion = false,
}: Companion2DRendererProps) {
  const companionId = isCompanionId(loadout.equipped.appearance)
    ? loadout.equipped.appearance
    : DEFAULT_COMPANION_ID
  const appearance = getCompanionItem(companionId)!
  const manifest = getCompanionAsset(companionId)
  const resolvedDirection = resolveFrameDirection(companionId, direction)
  const frame = manifest.frames[resolvedDirection]
  const motionStyle = resolveMotionStyle(motion, reduceMotion)
  const outfit = getCompanionItem(loadout.equipped.outfit)
  const decoration = getCompanionItem(loadout.equipped.decoration)
  const layers = frame
    ? [...frame.layers].sort((left, right) => LAYER_ORDER.indexOf(left.name) - LAYER_ORDER.indexOf(right.name))
    : []

  const attachmentItems = [outfit, decoration].filter((item) => item?.category === 'outfit' || item?.category === 'decoration')
  const attachments = attachmentItems.flatMap((item) => {
    if (!item) return []
    const frame = resolveAttachmentFrame(companionId, item.id, resolvedDirection)
    return frame ? [{ item, frame }] : []
  })

  const renderAttachments = (layer: AttachmentDisplayLayer): ReactNode => attachments
    .filter(({ frame: attachment }) => attachment.layer === layer)
    .map(({ item, frame: attachment }) => {
      const category = item.category as Exclude<CompanionCategory, 'appearance'>
      const style = {
        '--attachment-x': `${attachment.offset.x}%`,
        '--attachment-y': `${attachment.offset.y}%`,
        '--attachment-scale': attachment.scale,
        '--attachment-rotation': `${attachment.rotation}deg`,
      } as CSSProperties
      return (
        <span
          key={item.id}
          className={`companion-2d__attachment companion-2d__attachment--${attachment.layer} companion-2d__attachment--${category}`}
          data-testid={category === 'outfit' ? 'companion-outfit' : 'companion-decoration'}
          data-layer={attachment.layer}
          style={style}
        >
          <img
            data-testid={`companion-attachment-${item.id}`}
            data-layer={attachment.layer}
            data-direction={resolvedDirection}
            data-frame-url={attachment.url}
            src={attachment.url}
            alt=""
            draggable={false}
          />
        </span>
      )
    })

  return (
    <span
      className={[
        'companion-2d',
        `companion-2d--${scene}`,
        motionStyle.rootClass,
        interactive ? 'companion-2d--interactive' : '',
      ].filter(Boolean).join(' ')}
      data-testid="companion-2d"
      data-companion-id={companionId}
      data-scene={scene}
      data-direction={resolvedDirection}
      data-motion={motion}
      data-reduce-motion={String(reduceMotion)}
      role="img"
      aria-label={`${appearance.name} AI 伙伴形象`}
    >
      {renderAttachments('behind')}
      {frame ? layers.flatMap((layer, index) => {
        const characterLayer = (
          <img
            key={`${resolvedDirection}-${layer.name}`}
            data-testid={`companion-layer-${layer.name}`}
            data-layer={layer.name}
            className={['companion-2d__layer', layerMotionClass(layer.name, motionStyle)].filter(Boolean).join(' ')}
            src={layer.url}
            alt=""
            draggable={false}
            style={{ zIndex: index + 2 }}
          />
        )
        return layer.name === 'body'
          ? [characterLayer, renderAttachments('body')]
          : [characterLayer]
      }) : (
        <>
          <img
            data-testid="companion-fallback"
            className="companion-2d__fallback"
            src={manifest.fallbackImageUrl}
            alt=""
            draggable={false}
          />
          {renderAttachments('body')}
        </>
      )}
      {renderAttachments('front')}
    </span>
  )
}
