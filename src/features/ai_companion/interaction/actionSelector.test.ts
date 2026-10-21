import { describe, expect, it } from 'vitest'
import { canTriggerCompanionAction, selectCompanionAction } from './actionSelector'

describe('page-aware companion reactions', () => {
  it('selects short reactions that fit the current learning scene', () => {
    expect(selectCompanionAction({ scene: 'login', recentActions: [], progress: 0 })).toMatchObject({
      reactionId: 'login-wave',
      motion: 'wave',
    })
    expect(selectCompanionAction({ scene: 'home', recentActions: [], progress: 35 }).message).toContain('继续')
    expect(selectCompanionAction({ scene: 'knowledge', recentActions: [], progress: 60 }).message).toContain('知识')
    expect(selectCompanionAction({ scene: 'test-map', recentActions: [], progress: 80 }).message).toContain('关')
    expect(selectCompanionAction({ scene: 'mall', recentActions: [], progress: 0 }).message).toContain('转身')
  })

  it('does not repeat the immediately previous reaction', () => {
    const first = selectCompanionAction({ scene: 'login', recentActions: [], progress: 0 })
    const second = selectCompanionAction({ scene: 'login', recentActions: [first.reactionId], progress: 0 })

    expect(second.reactionId).not.toBe(first.reactionId)
  })

  it('limits proactive reactions to one every four seconds', () => {
    expect(canTriggerCompanionAction(null, 10_000)).toBe(true)
    expect(canTriggerCompanionAction(10_000, 13_999)).toBe(false)
    expect(canTriggerCompanionAction(10_000, 14_000)).toBe(true)
  })
})
