import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompanionLoadout } from '../../app/model'
import { PartnerAppearance } from './PartnerAppearance'

const layeredLoadout: CompanionLoadout = {
  owned: {
    appearance: ['momo'],
    outfit: ['cloud-backpack'],
    decoration: ['cloud-flower-lamp'],
  },
  equipped: {
    appearance: 'momo',
    outfit: 'cloud-backpack',
    decoration: 'cloud-flower-lamp',
  },
  version: 1,
}

describe('PartnerAppearance', () => {
  it('renders the equipped appearance and optional layers in one safe frame', () => {
    render(<PartnerAppearance loadout={layeredLoadout} size="login" />)

    expect(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-scene', 'login')
    expect(screen.getByTestId('companion-attachment-cloud-backpack')).toHaveAttribute('src', '/companions-2d/attachments/cloud-backpack/front.webp')
    expect(screen.getByTestId('companion-attachment-cloud-flower-lamp')).toHaveAttribute('src', '/companions-2d/attachments/cloud-flower-lamp/front.webp')
    expect(screen.getByTestId('partner-appearance')).toHaveAttribute('data-size', 'login')
  })

  it('uses Momo when the saved appearance no longer exists', () => {
    const invalidLoadout: CompanionLoadout = {
      ...layeredLoadout,
      equipped: { appearance: 'missing-pet', outfit: null, decoration: null },
    }

    render(<PartnerAppearance loadout={invalidLoadout} size="floating" />)

    expect(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
  })

  it('maps the legacy running motion to a 2.5D walk without dropping equipped layers', () => {
    render(<PartnerAppearance loadout={layeredLoadout} size="floating" motion="run" />)

    expect(screen.getByTestId('partner-appearance')).toHaveAttribute('data-motion', 'run')
    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-motion', 'walk')
    expect(screen.getByTestId('companion-outfit')).toBeInTheDocument()
    expect(screen.getByTestId('companion-decoration')).toBeInTheDocument()
  })

  it('accepts an explicit 2.5D direction, scene and reduced-motion preference', () => {
    render(
      <PartnerAppearance
        loadout={layeredLoadout}
        size="preview"
        direction="back"
        scene="chat"
        reduceMotion
      />,
    )

    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-direction', 'back')
    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-scene', 'chat')
    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-reduce-motion', 'true')
  })
})
