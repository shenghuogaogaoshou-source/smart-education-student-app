import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CompanionLoadout } from '../../../app/model'
import { CompanionRotator } from './CompanionRotator'

const momoLoadout: CompanionLoadout = {
  owned: { appearance: ['momo'], outfit: [], decoration: [] },
  equipped: { appearance: 'momo', outfit: null, decoration: null },
  version: 1,
}

describe('CompanionRotator', () => {
  it('keeps the dragged direction and reports it to the page', () => {
    const onDirectionChange = vi.fn()
    render(
      <CompanionRotator
        loadout={momoLoadout}
        scene="mall"
        initialDirection="front"
        onDirectionChange={onDirectionChange}
      />,
    )

    const stage = screen.getByTestId('companion-rotator-stage')
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 40 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 150, clientY: 60 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 150, clientY: 60 })

    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-direction', 'front-left')
    expect(onDirectionChange).toHaveBeenLastCalledWith('front-left')
  })

  it('offers keyboard-sized turn controls for children who cannot drag', async () => {
    const user = userEvent.setup()
    render(<CompanionRotator loadout={momoLoadout} scene="chat" initialDirection="front" />)

    await user.click(screen.getByRole('button', { name: '向右转动伙伴' }))
    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-direction', 'front-right')
    await user.click(screen.getByRole('button', { name: '向左转动伙伴' }))
    expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-direction', 'front')
  })

  it('notifies the parent only after the new direction is committed', async () => {
    const user = userEvent.setup()
    const committedDirections: Array<string | null> = []
    render(
      <CompanionRotator
        loadout={momoLoadout}
        scene="chat"
        initialDirection="front"
        onDirectionChange={() => {
          committedDirections.push(screen.getByTestId('companion-2d').getAttribute('data-direction'))
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: '向右转动伙伴' }))

    expect(committedDirections).toEqual(['front-right'])
  })
})
