import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CompanionLoadout } from '../../../app/model'
import { Companion2DRenderer } from './Companion2DRenderer'

function loadout(appearance: string): CompanionLoadout {
  return {
    owned: { appearance: ['momo', appearance], outfit: [], decoration: [] },
    equipped: { appearance, outfit: null, decoration: null },
    version: 1,
  }
}

describe('Companion2DRenderer', () => {
  it('renders the available Momo layers in their production stacking order', () => {
    render(
      <Companion2DRenderer
        loadout={loadout('momo')}
        scene="mall"
        direction="front"
        motion="wave"
      />,
    )

    const renderer = screen.getByTestId('companion-2d')
    expect(renderer).toHaveAttribute('data-companion-id', 'momo')
    expect(renderer).toHaveAttribute('data-scene', 'mall')
    expect(renderer).toHaveAttribute('data-direction', 'front')
    expect(renderer).toHaveAttribute('data-motion', 'wave')
    expect(screen.getAllByTestId(/companion-layer-/).map((node) => node.dataset.layer)).toEqual([
      'body',
      'head',
      'eyes',
      'mouth',
    ])
  })

  it('renders the Yunduo production body for the requested direction', () => {
    render(
      <Companion2DRenderer
        loadout={loadout('yunduo')}
        scene="floating"
        direction="back"
        motion="idle"
      />,
    )

    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-direction', 'back')
    expect(screen.getByTestId('companion-layer-body')).toHaveAttribute(
      'src',
      '/companions-2d/yunduo/back/body.webp',
    )
    expect(screen.queryByTestId('companion-fallback')).not.toBeInTheDocument()
  })

  it('marks reduced-motion scenes without dropping the selected character', () => {
    render(
      <Companion2DRenderer
        loadout={loadout('momo')}
        scene="handoff"
        direction="right"
        motion="walk"
        reduceMotion
      />,
    )

    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-reduce-motion', 'true')
    expect(screen.getByTestId('companion-2d')).toHaveClass('companion-motion--reduced')
  })

  it('rotates the equipped outfit and decoration into the correct front and rear layers', () => {
    const equippedLoadout: CompanionLoadout = {
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
    render(
      <Companion2DRenderer
        loadout={equippedLoadout}
        scene="mall"
        direction="back"
        motion="idle"
      />,
    )

    expect(screen.getByTestId('companion-attachment-cloud-backpack')).toHaveAttribute('data-layer', 'front')
    expect(screen.getByTestId('companion-attachment-cloud-backpack')).toHaveAttribute('data-direction', 'back')
    expect(screen.getByTestId('companion-attachment-cloud-backpack')).toHaveAttribute(
      'src',
      '/companions-2d/attachments/cloud-backpack/back.webp',
    )
    expect(screen.getByTestId('companion-attachment-cloud-flower-lamp')).toHaveAttribute('data-layer', 'behind')
    expect(screen.getByTestId('companion-outfit')).toContainElement(screen.getByTestId('companion-attachment-cloud-backpack'))
    expect(screen.getByTestId('companion-decoration')).toContainElement(screen.getByTestId('companion-attachment-cloud-flower-lamp'))
  })
})
