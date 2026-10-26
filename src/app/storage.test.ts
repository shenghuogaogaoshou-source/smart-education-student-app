import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultState } from './model'
import { getPointsBalance } from './points'
import { loadState, normalizePersistedState, saveState } from './storage'

describe('primary-only state migration', () => {
  beforeEach(() => localStorage.clear())

  it('starts with child-safe voice reply and motion preferences', () => {
    expect(createDefaultState()).toMatchObject({
      voiceReplyMode: 'voice-only',
      reduceMotion: false,
    })
  })

  it('creates the approved guardian-authorized grade-5 account', () => {
    const state = createDefaultState()

    expect(state.stateVersion).toBe(5)
    expect(state.learningEvents).toEqual([])
    expect(state.wrongAnswers).toEqual([])
    expect(state.growthTitle).toBeNull()
    expect(state.grade).toBe('grade5')
    expect(state.guardian.authorised).toBe(true)
    expect(state.learningProgress['grade5-6']).toEqual({
      knowledgeCompleted: ['ael-1', 'ael-2', 'ael-3'],
      testsPassed: ['ael-1', 'ael-2'],
    })
    expect(state.companion.equipped).toEqual({ appearance: 'momo', outfit: null, decoration: null })
    expect(state.transactions.map(({ amount }) => amount)).toEqual([90, 100, 40, 1770])
    expect(getPointsBalance(state.transactions)).toBe(2000)
  })

  it('replaces an old prototype state once without clearing unrelated keys', () => {
    localStorage.setItem('student-app-state', JSON.stringify({ stateVersion: 1, grade: 'grade8' }))
    localStorage.setItem('unrelated-preference', 'keep-me')

    const migrated = loadState()

    expect(migrated.stateVersion).toBe(5)
    expect(migrated.grade).toBe('grade5')
    expect(localStorage.getItem('unrelated-preference')).toBe('keep-me')
    expect(localStorage.getItem('student-app-primary-v3-migrated')).toBe('1')
    saveState({ ...migrated, nickname: '新名字' })
    expect(loadState().nickname).toBe('新名字')
  })

  it('falls back safely when stored JSON is broken', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 25, 12, 0))
    try {
      localStorage.setItem('student-app-state', '{broken')
      expect(loadState()).toEqual(createDefaultState())
    } finally {
      vi.useRealTimers()
    }
  })

  it('migrates a v3 account to v5 without retaining three legacy fake tasks', () => {
    const v3 = {
      ...createDefaultState(),
      stateVersion: 3,
      learningPlan: {
        tasks: ['图片识别小探索', '声音地图小任务', '提示词小练习'].map((title, index) => ({
          id: `legacy-${index}`, title, dayOffset: index, time: '19:00', minutes: 15,
        })),
      },
    }
    const migrated = normalizePersistedState(v3)
    expect(migrated.stateVersion).toBe(5)
    expect(migrated.learningPlan.tasks).toHaveLength(3)
    expect(migrated.learningPlan.tasks.every((task) => task.partId.startsWith('ael-'))).toBe(true)
    expect(migrated.learningPlan.tasks.some((task) => task.title === '图片识别小探索')).toBe(false)
    localStorage.setItem('student-app-state', JSON.stringify(v3))
    expect(loadState().stateVersion).toBe(5)
    const saved = JSON.parse(localStorage.getItem('student-app-state') ?? '{}')
    expect(saved.stateVersion).toBe(5)
    expect(saved.learningPlan.tasks.map((task: { partId: string; title: string }) => [task.partId, task.title])).toEqual(
      migrated.learningPlan.tasks.map((task) => [task.partId, task.title]),
    )
  })

  it('seeds real tasks from a non-grade-five account band during migration', () => {
    const migrated = normalizePersistedState({ ...createDefaultState(), stateVersion: 3, grade: 'grade3' })
    expect(migrated.learningPlan.tasks).toHaveLength(3)
    expect(migrated.learningPlan.tasks.map(({ grade, partId, title }) => [grade, partId, title])).toEqual([
      ['grade3', 'cxd-4', '真相侦探社'],
      ['grade3', 'cxd-5', '教 AI 认世界'],
      ['grade3', 'cxd-6', '负责任的创想家'],
    ])
  })

  it('discards stored tasks from another grade band on current-state load', () => {
    const defaultState = createDefaultState()
    const grade3Task = { ...defaultState.learningPlan.tasks[0], id: 'grade3-cxd-4', grade: 'grade3', partId: 'cxd-4' }
    const loaded = normalizePersistedState({
      ...defaultState,
      grade: 'grade3',
      learningPlan: { ...defaultState.learningPlan, tasks: [grade3Task, ...defaultState.learningPlan.tasks] },
    })
    expect(loaded.learningPlan.tasks.map(({ partId }) => partId)).toEqual(['cxd-4'])
  })

  it('drops unknown keys and invalid course progress when loading current state', () => {
    const state = createDefaultState()
    saveState(state)
    const persisted = JSON.parse(localStorage.getItem('student-app-state') ?? '{}')
    localStorage.setItem('student-app-state', JSON.stringify({
      ...persisted,
      unexpected: 'remove-me',
      grade: 'grade8',
      learningProgress: {
        ...state.learningProgress,
        'grade5-6': {
          knowledgeCompleted: ['ael-1', 'ael-99', 'retired-1'],
          testsPassed: ['ael-2', 'ael-20'],
        },
      },
    }))

    const loaded = loadState()

    expect(loaded.grade).toBe('grade5')
    expect(loaded.learningProgress['grade5-6']).toEqual({
      knowledgeCompleted: ['ael-1'],
      testsPassed: ['ael-2'],
    })
    saveState(loaded)
    expect(JSON.parse(localStorage.getItem('student-app-state') ?? '{}')).not.toHaveProperty('unexpected')
  })

  it('normalizes every hostile legacy field independently into a render-safe state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 25, 12, 0))
    localStorage.setItem('unrelated-preference', 'keep-me')
    localStorage.setItem('student-app-state', JSON.stringify({
      stateVersion: 2,
      grade: 'grade8',
      isLoggedIn: true,
      learningProgress: {
        'grade1-2': { knowledgeCompleted: [null], testsPassed: 'bad' },
        'grade3-4': null,
        'grade5-6': { knowledgeCompleted: ['ael-1', 2], testsPassed: ['ael-2', {}] },
      },
      transactions: [null],
      processedRewardIds: [null],
      aiPosition: { x: 'far', y: [] },
      companion: { owned: [], equipped: 'bad', version: 'latest' },
      fontScale: 'huge',
      nickname: '保留昵称',
      avatar: 'zero',
      likes: [null],
      favorites: {},
      notifications: 'sometimes',
      accountId: 123,
      passwordHint: false,
      lastPasswordChange: [],
      twoFactorEnabled: 'yes',
      guardian: { name: null, relationship: 'friend', phone: 123, authorised: 'yes' },
      familyName: null,
      devices: [{ name: '设备', lastActive: null, current: 'yes' }],
      aiName: {},
      aiPersonality: 'chaotic',
      aiSkin: null,
      voiceEnabled: 'yes',
      autoListenEnabled: 1,
      voiceMode: 'loud',
      saveHistory: 'yes',
      aiMemoryEnabled: null,
      historyCount: 'many',
      confirmDangerous: 1,
      guardianApprove: 'no',
      safeMode: 'unsafe',
      soundEnabled: 'yes',
      soundVolume: 'max',
      hapticEnabled: 1,
      showLearningStats: null,
      allowFriendFind: 'yes',
      dataCollection: [],
      cameraPermission: 'always',
      micPermission: false,
      albumPermission: 1,
      contentLevel: 'adult',
      personalizedRec: 'yes',
      storageUsed: 'full',
      storageTotal: null,
      autoCleanDays: 'never',
    }))

    try {
      const loaded = loadState()
      const fresh = createDefaultState()

      expect(loaded).toEqual({
        ...fresh,
        isLoggedIn: true,
        nickname: '保留昵称',
        learningProgress: {
          ...fresh.learningProgress,
          'grade5-6': {
            knowledgeCompleted: ['ael-1'],
            testsPassed: ['ael-2'],
          },
        },
        transactions: [],
        processedRewardIds: [],
        devices: [],
      })
      expect(() => getPointsBalance(loaded.transactions)).not.toThrow()
      expect(getPointsBalance(loaded.transactions)).toBe(0)
      expect(localStorage.getItem('unrelated-preference')).toBe('keep-me')
      expect(localStorage.getItem('student-app-primary-v2-migrated')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps valid collection entries when corrupt siblings are present', () => {
    const fresh = createDefaultState()
    const starter = {
      id: 'mixed-starter',
      eventId: 'mixed:starter',
      kind: 'starter',
      title: '保留的初始积分',
      amount: 1000,
      occurredAt: '2026-10-14',
    }
    const purchase = {
      id: 'mixed-purchase',
      eventId: 'purchase:yunduo',
      kind: 'purchase',
      title: '保留的购买记录',
      amount: -360,
      occurredAt: '2026-10-14',
    }
    const currentDevice = { name: '保留设备', lastActive: '刚刚', current: true }
    localStorage.setItem('student-app-state', JSON.stringify({
      ...fresh,
      transactions: [starter, null, { id: 'broken' }, purchase],
      processedRewardIds: ['mixed:starter', null, 'purchase:yunduo'],
      likes: ['lesson-kept', null],
      favorites: ['work-kept', {}, 'work-also-kept'],
      devices: [currentDevice, null, { name: '损坏设备' }],
      learningProgress: {
        ...fresh.learningProgress,
        'grade5-6': {
          knowledgeCompleted: ['ael-4', null, 'ael-99'],
          testsPassed: ['ael-4', false],
        },
      },
      companion: {
        owned: {
          appearance: ['momo', 'yunduo', null],
          outfit: ['cloud-backpack', 42],
          decoration: [null, 'cloud-flower-lamp'],
        },
        equipped: {
          appearance: 'yunduo',
          outfit: 'cloud-backpack',
          decoration: 'cloud-flower-lamp',
        },
        version: 1,
      },
    }))

    const loaded = loadState()

    expect(loaded.transactions).toEqual([starter, purchase])
    expect(getPointsBalance(loaded.transactions)).toBe(640)
    expect(loaded.processedRewardIds).toEqual(['mixed:starter', 'purchase:yunduo'])
    expect(loaded.likes).toEqual(['lesson-kept'])
    expect(loaded.favorites).toEqual(['work-kept', 'work-also-kept'])
    expect(loaded.devices).toEqual([currentDevice])
    expect(loaded.learningProgress['grade5-6']).toEqual({
      knowledgeCompleted: ['ael-4'],
      testsPassed: ['ael-4'],
    })
    expect(loaded.companion).toEqual({
      owned: {
        appearance: ['momo', 'yunduo'],
        outfit: ['cloud-backpack'],
        decoration: ['cloud-flower-lamp'],
      },
      equipped: {
        appearance: 'yunduo',
        outfit: 'cloud-backpack',
        decoration: 'cloud-flower-lamp',
      },
      version: 1,
    })
  })

  it('migrates v4 progress into events without changing points', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T10:00:00.000Z'))
    try {
      const v4 = { ...createDefaultState(), stateVersion: 4, learningEvents: undefined }
      const migrated = normalizePersistedState(v4)

      expect(migrated.stateVersion).toBe(5)
      expect(migrated.learningEvents.map(({ action, contentId }) => [action, contentId])).toEqual([
        ['knowledge-completed', 'ael-1'], ['knowledge-completed', 'ael-2'], ['knowledge-completed', 'ael-3'],
        ['test-passed', 'ael-1'], ['test-passed', 'ael-2'],
      ])
      expect(migrated.learningEvents.every((event) => event.migrationVersion === 1)).toBe(true)
      expect(migrated.transactions).toEqual(v4.transactions)
      expect(migrated.processedRewardIds).toEqual(v4.processedRewardIds)
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves a v4 migration once and does not duplicate migrated events on the next load', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T10:00:00.000Z'))
    try {
      const v4 = { ...createDefaultState(), stateVersion: 4, learningEvents: undefined }
      localStorage.setItem('student-app-state', JSON.stringify(v4))

      const first = loadState()
      const savedAfterFirstLoad = localStorage.getItem('student-app-state')
      const second = loadState()

      expect(first.learningEvents).toHaveLength(5)
      expect(second.learningEvents).toEqual(first.learningEvents)
      expect(localStorage.getItem('student-app-state')).toBe(savedAfterFirstLoad)
      expect(second.transactions).toEqual(v4.transactions)
      expect(second.processedRewardIds).toEqual(v4.processedRewardIds)
    } finally {
      vi.useRealTimers()
    }
  })

  it('normalizes events, wrong answers and growth title without one corrupt sibling clearing valid data', () => {
    const fresh = createDefaultState()
    const event = {
      id: 'chenxi_2026:grade5-6:knowledge-completed:ael-4',
      accountId: 'chenxi_2026',
      gradeBand: 'grade5-6',
      source: 'knowledge',
      contentId: 'ael-4',
      action: 'knowledge-completed',
      occurredAt: '2026-10-26T09:00:00.000Z',
      dimensionDeltas: { curiosity: 2, knowledge: 4, problemSolving: 0, creativity: 0, planning: 0 },
    }
    const wrongAnswer = {
      id: 'grade5-6:ael-4:q-1',
      gradeBand: 'grade5-6',
      partId: 'ael-4',
      questionId: 'q-1',
      prompt: '下列哪项正确？',
      options: ['A', 'B'],
      selectedIndex: 1,
      answerIndex: 0,
      explanation: 'A 才是正确答案。',
      occurredAt: '2026-10-26T09:00:00.000Z',
      correctedAt: null,
    }
    const growthTitle = { text: '好奇探索者', description: '愿意继续提问与发现。', eventId: event.id }

    const loaded = normalizePersistedState({
      ...fresh,
      learningEvents: [event, { ...event, id: 'forged-id' }, null],
      wrongAnswers: [wrongAnswer, { ...wrongAnswer, selectedIndex: 99 }, null],
      growthTitle,
    })

    expect(loaded.learningEvents).toEqual([event])
    expect(loaded.wrongAnswers).toEqual([wrongAnswer])
    expect(loaded.growthTitle).toEqual(growthTitle)
  })
})
