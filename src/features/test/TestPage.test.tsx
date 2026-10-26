import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState } from '../../app/companionAccountRepository'
import { createEmptyLearningProgress, getGradeBand, getPartIdsForBand, type CoursePartId } from '../../app/learning'
import { defaultState, type AppState } from '../../app/model'
import { getPointsBalance } from '../../app/points'
import { saveState } from '../../app/storage'
import { getCourseForBand } from '../knowledge/courseCatalog'
import { getMapNodes } from './testMapData'
import { TestPage } from './TestPage'

function renderMap(
  state: Partial<AppState> = {},
  onReviewKnowledge?: (courseId: string, chapterNum: number) => void,
  initialPartId?: CoursePartId,
) {
  saveState({ ...defaultState, ...state })
  return render(
    <AppStateProvider>
      <TestPage initialPartId={initialPartId} onReviewKnowledge={onReviewKnowledge} />
    </AppStateProvider>,
  )
}

describe('TestPage', () => {
  beforeEach(() => localStorage.clear())

  it('uses the shared grade-band course and gives every part one map node', () => {
    for (const grade of ['grade1', 'grade3', 'grade5'] as const) {
      const band = getGradeBand(grade)
      const course = getCourseForBand(band)
      const nodes = getMapNodes(course.id)

      expect(nodes.map((node) => node.id)).toEqual(getPartIdsForBand(band))
      expect(nodes.every((node) => node.x >= 10 && node.x <= 90)).toBe(true)
      expect(nodes.every((node) => node.y >= 10 && node.y <= 90)).toBe(true)
    }
  })

  it('blocks a test whose matching knowledge is incomplete', async () => {
    const user = userEvent.setup()
    renderMap({
      grade: 'grade5',
      learningProgress: {
        ...createEmptyLearningProgress(),
        'grade5-6': { knowledgeCompleted: ['ael-1'], testsPassed: [] },
      },
    })

    await user.click(screen.getByRole('button', { name: '数据侦探营 · 先学知识' }))

    expect(screen.getByRole('status')).toHaveTextContent('先完成第 2 部分知识')
    expect(screen.queryByRole('button', { name: '开始答题' })).not.toBeInTheDocument()
  })

  it('shows an introduction before opening an unlocked quiz', async () => {
    const user = userEvent.setup()
    renderMap({ grade: 'grade5' })

    await user.click(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
    expect(screen.getByRole('dialog', { name: '算法工具箱挑战介绍' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始答题' }))
    expect(screen.getByRole('heading', { name: '算法工具箱' })).toBeInTheDocument()
  })

  it('traps challenge-introduction focus and restores the node after closing', async () => {
    const user = userEvent.setup()
    renderMap({ grade: 'grade5' })

    const node = screen.getByRole('button', { name: '算法工具箱 · 当前关卡' })
    await user.click(node)
    const dialog = screen.getByRole('dialog', { name: '算法工具箱挑战介绍' })
    const closeButton = within(dialog).getByRole('button', { name: '关闭挑战介绍' })
    const startButton = within(dialog).getByRole('button', { name: '开始答题' })

    await waitFor(() => expect(closeButton).toHaveFocus())
    startButton.focus()
    await user.tab()
    expect(closeButton).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '算法工具箱挑战介绍' })).not.toBeInTheDocument()
    expect(node).toHaveFocus()
  })

  it('returns focus to the map node after closing the quiz launched from its introduction', async () => {
    const user = userEvent.setup()
    renderMap({ grade: 'grade5' })

    const node = screen.getByRole('button', { name: '算法工具箱 · 当前关卡' })
    await user.click(node)
    await user.click(screen.getByRole('button', { name: '开始答题' }))

    const quiz = screen.getByRole('dialog', { name: '算法工具箱答题' })
    await user.click(within(quiz).getByRole('button', { name: '关闭' }))

    expect(screen.queryByRole('dialog', { name: '算法工具箱答题' })).not.toBeInTheDocument()
    expect(node).toHaveFocus()
  })

  it('focuses the requested unlocked plan test and opens its introduction', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('test-route-canvas')) return 900
      if (this.classList.contains('test-route-scroll')) return 420
      return 0
    })
    renderMap({ grade: 'grade5' }, undefined, 'ael-3')

    const dialog = await screen.findByRole('dialog', { name: '算法工具箱挑战介绍' })
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: '关闭挑战介绍' })).toHaveFocus()
    })
    const route = screen.getByRole('region', { name: '可上下滑动的完整闯关地图' }).closest('.test-route-scroll')
    expect(route).not.toBeNull()
    expect((route as HTMLElement).scrollTop).toBeGreaterThan(0)
  })

  it('keeps a requested locked plan test closed and explains the knowledge prerequisite', async () => {
    renderMap({
      grade: 'grade5',
      learningProgress: {
        ...createEmptyLearningProgress(),
        'grade5-6': { knowledgeCompleted: ['ael-1'], testsPassed: [] },
      },
    }, undefined, 'ael-4')

    expect(await screen.findByRole('status')).toHaveTextContent('先完成第 4 部分知识')
    expect(screen.queryByRole('dialog', { name: '第一次 AI 实验挑战介绍' })).not.toBeInTheDocument()
  })

  it('keeps the companion centered above the current node and moves it after passing', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('[data-node-anchor="ael-3"]')) {
        return { left: 60, top: 400, right: 110, bottom: 450, width: 50, height: 50 } as DOMRect
      }
      if (this.classList.contains('test-route-canvas')) {
        return { left: 20, top: 100, right: 370, bottom: 1000, width: 350, height: 900 } as DOMRect
      }
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
    })
    const user = userEvent.setup()
    renderMap({ grade: 'grade5' })

    const companion = screen.getByRole('button', { name: 'AI伙伴' })
    expect(companion).toHaveAttribute('data-map-node-id', 'ael-3')
    await waitFor(() => expect(companion).toHaveStyle({ left: '33px', top: '228px' }))
    expect(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
      .toHaveAttribute('data-node-anchor', 'ael-3')
    await user.click(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    for (const answer of ['分类', '聚类', '数值预测', '错', '先说明需求并允许同学调整']) {
      await user.click(screen.getByRole('button', { name: answer }))
      await user.click(screen.getByRole('button', { name: /下一题|查看成绩/ }))
    }

    expect(screen.getByText('通关成功！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI伙伴' })).toHaveAttribute('data-map-node-id', 'ael-4')
  })

  it('persists a passing reward once when the same challenge is completed again', async () => {
    const user = userEvent.setup()
    renderMap({ grade: 'grade5' })
    const balanceBefore = getPointsBalance(defaultState.transactions)

    async function passCurrentChallenge() {
      await user.click(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
      await user.click(screen.getByRole('button', { name: '开始答题' }))
      for (const answer of ['分类', '聚类', '数值预测', '错', '先说明需求并允许同学调整']) {
        await user.click(screen.getByRole('button', { name: answer }))
        await user.click(screen.getByRole('button', { name: /下一题|查看成绩/ }))
      }
      await user.click(screen.getByRole('button', { name: '完成' }))
    }

    await passCurrentChallenge()
    await user.click(screen.getByRole('button', { name: '算法工具箱 · 已通关' }))
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    for (const answer of ['分类', '聚类', '数值预测', '错', '先说明需求并允许同学调整']) {
      await user.click(screen.getByRole('button', { name: answer }))
      await user.click(screen.getByRole('button', { name: /下一题|查看成绩/ }))
    }

    const saved = loadAccountState(defaultState.accountId)
    expect(saved.learningProgress['grade5-6'].testsPassed).toEqual(['ael-1', 'ael-2', 'ael-3'])
    expect(saved.transactions.filter((item) => item.eventId === 'test:ael-3')).toEqual([
      expect.objectContaining({ amount: 50 }),
    ])
    expect(saved.transactions.filter((item) => item.eventId === 'medal:ael-3')).toEqual([
      expect.objectContaining({ amount: 20 }),
    ])
    expect(saved.learningEvents.filter((event) => (
      event.action === 'test-passed' && event.contentId === 'ael-3'
    ))).toHaveLength(1)
    expect(getPointsBalance(saved.transactions)).toBe(balanceBefore + 70)
  })

  it('offers knowledge review and retry after a failed challenge without a reward', async () => {
    const user = userEvent.setup()
    const onReviewKnowledge = vi.fn()
    renderMap({ grade: 'grade5' }, onReviewKnowledge)
    const balanceBefore = getPointsBalance(defaultState.transactions)
    const transactionCountBefore = defaultState.transactions.length

    await user.click(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    for (const answer of ['聚类', '分类', '分类', '对', '直接替所有人决定']) {
      await user.click(screen.getByRole('button', { name: answer }))
      await user.click(screen.getByRole('button', { name: /下一题|查看成绩/ }))
    }

    expect(screen.getByText('再试一次吧')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再试一次' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '回顾第 3 部分知识' }))
    expect(onReviewKnowledge).toHaveBeenCalledWith('ael', 3)
    expect(screen.queryByRole('dialog', { name: '算法工具箱答题' })).not.toBeInTheDocument()
    const saved = loadAccountState(defaultState.accountId)
    expect(saved.learningProgress['grade5-6'].testsPassed).toEqual(['ael-1', 'ael-2'])
    expect(getPointsBalance(saved.transactions)).toBe(balanceBefore)
    expect(saved.transactions).toHaveLength(transactionCountBefore)
    expect(saved.transactions.some((item) => item.eventId === 'test:ael-3')).toBe(false)
    expect(saved.transactions.some((item) => item.eventId === 'medal:ael-3')).toBe(false)
    expect(saved.learningEvents.some((event) => event.action === 'test-passed' && event.contentId === 'ael-3')).toBe(false)
    expect(saved.wrongAnswers).toHaveLength(5)
    expect(saved.wrongAnswers[0]).toMatchObject({
      id: expect.stringMatching(/^grade5-6:ael-3:/),
      partId: 'ael-3',
      selectedIndex: 1,
      answerIndex: 0,
      correctedAt: null,
    })
  })

  it.each([
    ['grade1', 'grade1-2', 8],
    ['grade3', 'grade3-4', 6],
    ['grade6', 'grade5-6', 9],
  ] as const)('renders the full vertical challenge map for %s', (grade, band, expectedParts) => {
    const allParts = getPartIdsForBand(band)
    renderMap({
      grade,
      learningProgress: {
        ...createEmptyLearningProgress(),
        [band]: { knowledgeCompleted: allParts, testsPassed: [] },
      },
    })

    const route = screen.getByRole('region', { name: '可上下滑动的完整闯关地图' })
    expect(route).toHaveAttribute('tabindex', '0')
    expect(within(route).getAllByRole('button')).toHaveLength(expectedParts)
    if (band === 'grade5-6') {
      expect(within(route).getByRole('button', { name: '我的 AI 小项目 · 可挑战' })).toBeInTheDocument()
    }
  })
})
