export const COMPANION_DIRECTIONS = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
] as const

export type CompanionDirection = (typeof COMPANION_DIRECTIONS)[number]

export type CompanionLayerName =
  | 'shadow'
  | 'behind'
  | 'body'
  | 'head'
  | 'arm-left'
  | 'arm-right'
  | 'eyes'
  | 'mouth'
  | 'front'

export type CompanionMotion =
  | 'idle'
  | 'blink'
  | 'wave'
  | 'tilt'
  | 'walk'
  | 'listen'
  | 'think'
  | 'speak'
  | 'celebrate'

export type CompanionScene =
  | 'login'
  | 'floating'
  | 'test-map'
  | 'mall'
  | 'chat'
  | 'handoff'

export type CompanionLayer = {
  name: CompanionLayerName
  url: string
}

export type CompanionDirectionFrame = {
  direction: CompanionDirection
  canvas: { width: number; height: number }
  layers: CompanionLayer[]
  origin: { x: number; y: number }
  visualBounds: { x: number; y: number; width: number; height: number }
}

export type Companion2DAssetManifest = {
  id: string
  fallbackImageUrl: string
  frames: Partial<Record<CompanionDirection, CompanionDirectionFrame>>
}
