import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultState, type CompanionLoadout } from './model'
import {
  accountStorageKey,
  appendConversationSummary,
  clearAccountState,
  loadAccountState,
  peekAccountCompanion,
  saveAccountState,
} from './companionAccountRepository'

function stateWithAppearance(appearance: string) {
  const state = createDefaultState()
  const companion: CompanionLoadout = {
    ...state.companion,
    owned: {
      ...state.companion.owned,
      appearance: ['momo', appearance],
    },
    equipped: {
      ...state.companion.equipped,
      appearance,
    },
  }

  return { ...state, companion }
}

describe('companion account repository', () => {
  beforeEach(() => localStorage.clear())

  it('keeps companion data isolated by normalized learning account', () => {
    saveAccountState('ChenXi 2026', stateWithAppearance('yunduo'))
    saveAccountState('xiaoyu', stateWithAppearance('cloudbloom'))

    expect(loadAccountState('  chenxi   2026 ').companion.equipped.appearance).toBe('yunduo')
    expect(loadAccountState('XIAOYU').companion.equipped.appearance).toBe('cloudbloom')
  })

  it('migrates the default demo account from the legacy key without losing learning data', () => {
    const legacy = createDefaultState()
    localStorage.setItem('student-app-state', JSON.stringify({
      ...legacy,
      stateVersion: 2,
      nickname: '迁移同学',
      learningProgress: {
        ...legacy.learningProgress,
        'grade5-6': { knowledgeCompleted: ['ael-4'], testsPassed: ['ael-4'] },
      },
      companion: {
        owned: {
          appearance: ['momo', 'retired-pet'],
          outfit: [],
          decoration: ['cloud-backpack'],
        },
        equipped: {
          appearance: 'retired-pet',
          outfit: null,
          decoration: 'cloud-backpack',
        },
        version: 1,
      },
    }))

    const migrated = loadAccountState('chenxi_2026')

    expect(migrated.stateVersion).toBe(3)
    expect(migrated.nickname).toBe('迁移同学')
    expect(migrated.learningProgress['grade5-6']).toEqual({
      knowledgeCompleted: ['ael-4'],
      testsPassed: ['ael-4'],
    })
    expect(migrated.companion.owned.outfit).toContain('cloud-backpack')
    expect(migrated.companion.equipped).toEqual({ appearance: 'momo', outfit: null, decoration: null })
    expect(localStorage.getItem('student-app-state')).toBeNull()
    expect(localStorage.getItem(accountStorageKey('chenxi_2026'))).not.toBeNull()
  })

  it('removes retired companion ids without clearing valid learning data', () => {
    const state = createDefaultState()
    localStorage.setItem(accountStorageKey('demo'), JSON.stringify({
      ...state,
      stateVersion: 3,
      learningProgress: {
        ...state.learningProgress,
        'grade5-6': { knowledgeCompleted: ['ael-3'], testsPassed: ['ael-2'] },
      },
      companion: {
        owned: {
          appearance: ['momo', 'nimbo'],
          outfit: ['cloud-backpack'],
          decoration: [],
        },
        equipped: { appearance: 'nimbo', outfit: 'cloud-backpack', decoration: null },
        version: 1,
      },
    }))

    const loaded = loadAccountState('demo')

    expect(loaded.companion.owned.appearance).toEqual(['momo'])
    expect(loaded.companion.equipped.appearance).toBe('momo')
    expect(loaded.learningProgress['grade5-6']).toEqual({
      knowledgeCompleted: ['ael-3'],
      testsPassed: ['ael-2'],
    })
  })

  it('keeps only the newest twenty reviewed conversation summaries', () => {
    for (let index = 0; index < 22; index += 1) {
      appendConversationSummary('demo', {
        id: `summary-${index}`,
        topic: `话题 ${index}`,
        summary: `已审核摘要 ${index}`,
        occurredAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
      })
    }

    const loaded = loadAccountState('demo')
    expect(loaded.conversationSummaries).toHaveLength(20)
    expect(loaded.conversationSummaries[0]?.id).toBe('summary-2')
    expect(loaded.conversationSummaries[19]?.id).toBe('summary-21')
  })

  it('clears only the selected account', () => {
    saveAccountState('one', stateWithAppearance('yunduo'))
    saveAccountState('two', stateWithAppearance('cloudbloom'))

    clearAccountState('one')

    expect(localStorage.getItem(accountStorageKey('one'))).toBeNull()
    expect(loadAccountState('two').companion.equipped.appearance).toBe('cloudbloom')
  })

  it('previews an unknown account without creating persistent demo data', () => {
    expect(peekAccountCompanion('new-student').equipped.appearance).toBe('momo')
    expect(localStorage.getItem(accountStorageKey('new-student'))).toBeNull()
  })
})
