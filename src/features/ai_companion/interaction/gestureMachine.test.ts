import { describe, expect, it } from 'vitest'
import { createGestureMachine } from './gestureMachine'

describe('companion gesture machine', () => {
  it('emits one tap for a short stationary press', () => {
    const machine = createGestureMachine({ longPressMs: 600, moveThreshold: 8 })

    expect(machine.send({ type: 'down', x: 0, y: 0, at: 0 })).toBeNull()
    expect(machine.send({ type: 'up', x: 0, y: 0, at: 120 })).toEqual({ kind: 'tap' })
    expect(machine.send({ type: 'up', x: 0, y: 0, at: 140 })).toBeNull()
  })

  it('emits long press once and never follows it with a tap', () => {
    const machine = createGestureMachine({ longPressMs: 600, moveThreshold: 8 })

    machine.send({ type: 'down', x: 0, y: 0, at: 0 })
    expect(machine.send({ type: 'tick', at: 600 })).toEqual({ kind: 'long-press' })
    expect(machine.send({ type: 'tick', at: 900 })).toBeNull()
    expect(machine.send({ type: 'up', x: 0, y: 0, at: 950 })).toEqual({ kind: 'long-press-end' })
  })

  it('turns movement beyond eight pixels into a drag and cancels long press', () => {
    const machine = createGestureMachine({ longPressMs: 600, moveThreshold: 8 })

    machine.send({ type: 'down', x: 0, y: 0, at: 0 })
    expect(machine.send({ type: 'move', x: 12, y: 0, at: 100 })).toEqual({ kind: 'drag-start', x: 12, y: 0 })
    expect(machine.send({ type: 'tick', at: 700 })).toBeNull()
    expect(machine.send({ type: 'move', x: 18, y: 4, at: 720 })).toEqual({ kind: 'drag', x: 18, y: 4 })
    expect(machine.send({ type: 'up', x: 18, y: 4, at: 740 })).toEqual({ kind: 'drag-end', x: 18, y: 4 })
  })

  it('cancels the active gesture without producing a later action', () => {
    const machine = createGestureMachine({ longPressMs: 600, moveThreshold: 8 })

    machine.send({ type: 'down', x: 0, y: 0, at: 0 })
    expect(machine.send({ type: 'cancel', at: 200 })).toEqual({ kind: 'cancel' })
    expect(machine.send({ type: 'tick', at: 800 })).toBeNull()
    expect(machine.send({ type: 'up', x: 0, y: 0, at: 820 })).toBeNull()
  })
})
