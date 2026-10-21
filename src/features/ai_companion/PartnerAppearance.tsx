import type { CompanionLoadout } from '../../app/model'
import { Companion2DRenderer } from './render2d/Companion2DRenderer'
import type { CompanionDirection, CompanionMotion, CompanionScene } from './render2d/types'
import './ai-companion.css'

type PartnerAppearanceProps = {
  loadout: CompanionLoadout
  size: 'login' | 'preview' | 'floating'
  motion?: CompanionMotion | 'run'
  interactive?: boolean
  direction?: CompanionDirection
  scene?: CompanionScene
  reduceMotion?: boolean
}

const SIZE_SCENES: Record<PartnerAppearanceProps['size'], CompanionScene> = {
  login: 'login',
  preview: 'mall',
  floating: 'floating',
}

export function PartnerAppearance({
  loadout,
  size,
  motion = 'idle',
  interactive = false,
  direction = 'front',
  scene,
  reduceMotion = false,
}: PartnerAppearanceProps) {
  const rendererMotion = motion === 'run' ? 'walk' : motion

  return (
    <span
      className={`partner-appearance partner-appearance--${size} ${interactive ? 'partner-appearance--interactive' : ''}`.trim()}
      data-testid="partner-appearance"
      data-size={size}
      data-companion-id={loadout.equipped.appearance}
      data-outfit-id={loadout.equipped.outfit ?? ''}
      data-decoration-id={loadout.equipped.decoration ?? ''}
      data-motion={motion}
    >
      <span className="partner-appearance__safe-frame">
        <Companion2DRenderer
          loadout={loadout}
          scene={scene ?? SIZE_SCENES[size]}
          direction={direction}
          motion={rendererMotion}
          interactive={interactive}
          reduceMotion={reduceMotion}
        />
      </span>
    </span>
  )
}
