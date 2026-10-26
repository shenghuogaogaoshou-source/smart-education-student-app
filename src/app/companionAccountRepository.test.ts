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

    expect(migrated.stateVersion).toBe(5)
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

  it('persists learning plans independently by account and derives no plan rewards', () => {
    const first = createDefaultState()
    const second = createDefaultState()
    first.learningPlan.tasks = [{ ...first.learningPlan.tasks[0], id: 'custom-first', title: '第一账号安排' }]
    second.learningPlan.tasks = [{ ...second.learningPlan.tasks[0], id: 'custom-second', title: '第二账号安排' }]
    saveAccountState('first', first)
    saveAccountState('second', second)

    expect(loadAccountState('first').learningPlan.tasks.map((task) => task.title)).toEqual(['第一账号安排'])
    expect(loadAccountState('second').learningPlan.tasks.map((task) => task.title)).toEqual(['第二账号安排'])
    expect(loadAccountState('first').transactions).toEqual(first.transactions)
    expect(loadAccountState('first').processedRewardIds).toEqual(first.processedRewardIds)
  })

  it('keeps learning events, wrong answers and growth titles isolated by normalized account', () => {
    const first = createDefaultState()
    const second = createDefaultState()
    first.learningEvents = [{
      id: 'first:grade5-6:knowledge-completed:ael-4',
      accountId: 'first',
      gradeBand: 'grade5-6',
      source: 'knowledge',
      contentId: 'ael-4',
      action: 'knowledge-completed',
      occurredAt: '2026-10-26T09:00:00.000Z',
      dimensionDeltas: { curiosity: 2, knowledge: 4, problemSolving: 0, creativity: 0, planning: 0 },
    }]
    second.learningEvents = [{
      id: 'second:grade3-4:test-passed:cxd-2',
      accountId: 'second',
      gradeBand: 'grade3-4',
      source: 'test',
      contentId: 'cxd-2',
      action: 'test-passed',
      occurredAt: '2026-10-26T09:05:00.000Z',
      dimensionDeltas: { curiosity: 0, knowledge: 2, problemSolving: 4, creativity: 0, planning: 0 },
    }]
    first.wrongAnswers = [{
      id: 'first-wrong',
      gradeBand: 'grade5-6',
      partId: 'ael-4',
      questionId: 'q-first',
      prompt: '第一账号错题',
      options: ['正确', '错误'],
      selectedIndex: 1,
      answerIndex: 0,
      explanation: '第一账号解析',
      occurredAt: '2026-10-26T09:00:00.000Z',
      correctedAt: null,
    }]
    second.wrongAnswers = [{
      id: 'second-wrong',
      gradeBand: 'grade3-4',
      partId: 'cxd-2',
      questionId: 'q-second',
      prompt: '第二账号错题',
      options: ['正确', '错误'],
      selectedIndex: 1,
      answerIndex: 0,
      explanation: '第二账号解析',
      occurredAt: '2026-10-26T09:05:00.000Z',
      correctedAt: null,
    }]
    first.growthTitle = { text: '第一账号称号', description: '第一账号描述', eventId: first.learningEvents[0].id }
    second.growthTitle = { text: '第二账号称号', description: '第二账号描述', eventId: second.learningEvents[0].id }

    saveAccountState('FIRST', first)
    saveAccountState('second', second)

    const loadedFirst = loadAccountState(' first ')
    const loadedSecond = loadAccountState('SECOND')

    expect(loadedFirst.learningEvents).toEqual(first.learningEvents)
    expect(loadedFirst.wrongAnswers).toEqual(first.wrongAnswers)
    expect(loadedFirst.growthTitle).toEqual(first.growthTitle)
    expect(loadedSecond.learningEvents).toEqual(second.learningEvents)
    expect(loadedSecond.wrongAnswers).toEqual(second.wrongAnswers)
    expect(loadedSecond.growthTitle).toEqual(second.growthTitle)
  })

  it('keeps only the newest twenty reviewed conversation summaries', () => {
    for (let index = 0; index < 22; index += 1) {
      appendConversationSummary('demo', {
        id: `summary-${index}`,
        topic: `话题 ${index}`,
        summary: `已审核摘要 ${index}`,
        occurredAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
        messageCount: index + 1,
      })
    }

    const loaded = loadAccountState('demo')
    expect(loaded.conversationSummaries).toHaveLength(20)
    expect(loaded.conversationSummaries[0]?.id).toBe('summary-2')
    expect(loaded.conversationSummaries[19]?.id).toBe('summary-21')
  })

  it('normalizes legacy and invalid conversation message counts to one', () => {
    const state = createDefaultState()
    localStorage.setItem(accountStorageKey('counts'), JSON.stringify({
      ...state,
      conversationSummaries: [
        { id: 'legacy', topic: '旧摘要', summary: '缺字段', occurredAt: '2026-10-20T09:00:00.000Z' },
        { id: 'valid', topic: '新摘要', summary: '有字段', occurredAt: '2026-10-21T09:00:00.000Z', messageCount: 7 },
        { id: 'invalid', topic: '坏字段', summary: '零条', occurredAt: '2026-10-22T09:00:00.000Z', messageCount: 0 },
      ],
    }))

    expect(loadAccountState('counts').conversationSummaries.map(({ id, messageCount }) => [id, messageCount])).toEqual([
      ['legacy', 1],
      ['valid', 7],
      ['invalid', 1],
    ])
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
