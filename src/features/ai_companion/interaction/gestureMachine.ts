export type CompanionGestureInput =
  | { type: 'down'; x: number; y: number; at: number }
  | { type: 'move'; x: number; y: number; at: number }
  | { type: 'up'; x: number; y: number; at: number }
  | { type: 'tick'; at: number }
  | { type: 'cancel'; at: number }

export type CompanionGestureResult =
  | { kind: 'tap' }
  | { kind: 'long-press' }
  | { kind: 'long-press-end' }
  | { kind: 'drag-start'; x: number; y: number }
  | { kind: 'drag'; x: number; y: number }
  | { kind: 'drag-end'; x: number; y: number }
  | { kind: 'cancel' }

type GesturePhase = 'idle' | 'pressed' | 'long-press' | 'drag'

export function createGestureMachine({
  longPressMs,
  moveThreshold,
}: {
  longPressMs: number
  moveThreshold: number
}) {
  let phase: GesturePhase = 'idle'
  let startedAt = 0
  let startX = 0
  let startY = 0

  const reset = () => {
    phase = 'idle'
    startedAt = 0
    startX = 0
    startY = 0
  }

  return {
    send(input: CompanionGestureInput): CompanionGestureResult | null {
      if (input.type === 'down') {
        phase = 'pressed'
        startedAt = input.at
        startX = input.x
        startY = input.y
        return null
      }

      if (input.type === 'cancel') {
        if (phase === 'idle') return null
        reset()
        return { kind: 'cancel' }
      }

      if (phase === 'idle') return null

      if (input.type === 'tick') {
        if (phase !== 'pressed' || input.at - startedAt < longPressMs) return null
        phase = 'long-press'
        return { kind: 'long-press' }
      }

      if (input.type === 'move') {
        if (phase === 'long-press') return null
        if (phase === 'drag') return { kind: 'drag', x: input.x, y: input.y }
        if (Math.hypot(input.x - startX, input.y - startY) < moveThreshold) return null
        phase = 'drag'
        return { kind: 'drag-start', x: input.x, y: input.y }
      }

      if (input.type === 'up') {
        if (phase === 'drag') {
          reset()
          return { kind: 'drag-end', x: input.x, y: input.y }
        }
        if (phase === 'long-press') {
          reset()
          return { kind: 'long-press-end' }
        }
        const elapsed = input.at - startedAt
        reset()
        return elapsed < longPressMs ? { kind: 'tap' } : null
      }

      return null
    },
    reset,
  }
}
