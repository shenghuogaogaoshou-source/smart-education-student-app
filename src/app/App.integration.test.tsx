import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WORK_SAVE_DRAFT } from '@zhiya/works-bridge'
import { App } from './App'
import { loadAccountState, saveAccountState } from './companionAccountRepository'
import { createDefaultState } from './model'
import { getCourseForBand, type QuizQuestion } from '../features/knowledge/courseCatalog'

function dispatchBrainFilmSave() {
  const frame = screen.getByTitle('脑洞放映厅') as HTMLIFrameElement
  const data = new Blob(['film'], { type: 'application/json' })
  Object.defineProperty(data, 'size', { value: 4 })
  const event = new MessageEvent('message', {
    origin: 'http://127.0.0.1:5191',
    source: frame.contentWindow,
    data: {
      type: WORK_SAVE_DRAFT,
      version: 1,
      source: 'brain-film',
      draftId: 'e2e-film',
      title: '成长小电影',
      description: '完成知识与挑战后的创作',
      fileName: 'growth.bhfilm',
      blob: data,
    },
  })
  window.dispatchEvent(event)
}

describe('student app integration', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not expose another learning mode anywhere in the rendered app', () => {
    render(<App />)
    const retiredCopy = new RegExp([
      '中学' + '端',
      '初' + '中',
      '七至' + '九年级',
      '7' + '—9',
    ].join('|'))
    expect(screen.queryByText(retiredCopy)).not.toBeInTheDocument()
    expect(document.documentElement).not.toHaveAttribute('data-stage')
  })

  it('moves from login through all four destinations and back through logout', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByRole('button', { name: '小学端' })).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('学习账号／学习码'))
    await user.clear(screen.getByLabelText('密码'))
    await user.type(screen.getByLabelText('学习账号／学习码'), '123')
    await user.type(screen.getByLabelText('密码'), '123')
    await user.click(screen.getByRole('button', { name: '进入学习世界' }))
    expect(screen.getByRole('heading', { name: '精选 AI 创意游戏' })).toBeInTheDocument()
    expect(screen.getByText('AI 通识新鲜报')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '知识' }))
    expect(screen.getByRole('heading', { name: 'AI 探索实验室' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '测试' }))
    expect(screen.getByRole('region', { name: '闯关地图' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '我的' }))
    expect(screen.getByRole('heading', { name: '晨曦同学' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '进入设置' }))
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '退出当前账号' }))
    await user.click(screen.getByRole('button', { name: '确认退出' }))
    expect(screen.getByRole('heading', { name: '欢迎来到智芽' })).toBeInTheDocument()
  })

  it('completes the approved primary-only demonstration journey', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.clear(screen.getByLabelText('学习账号／学习码'))
    await user.clear(screen.getByLabelText('密码'))
    await user.type(screen.getByLabelText('学习账号／学习码'), '123')
    await user.type(screen.getByLabelText('密码'), '123')
    await user.click(screen.getByRole('button', { name: '进入学习世界' }))

    await user.click(screen.getByRole('button', { name: '知识' }))
    expect(screen.getByRole('heading', { name: 'AI 探索实验室' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /第一次 AI 实验.*当前学习/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '测试' }))
    expect(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第一次 AI 实验 · 先学知识' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '我的' }))
    expect(screen.getByText('2,000')).toBeInTheDocument()
    await user.click(screen.getByText('积分商城'))
    expect(screen.getByText('绒桃 Momo')).toBeInTheDocument()
    expect(screen.queryByText('云宝 Nimbo')).not.toBeInTheDocument()
  })

  it('records one real learning journey and updates growth and medals', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T10:00:00+08:00'))
    const firstAccount = createDefaultState()
    firstAccount.learningPlan.tasks = []
    saveAccountState(firstAccount.accountId, firstAccount)
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByLabelText('学习账号／学习码'))
    await user.clear(screen.getByLabelText('密码'))
    await user.type(screen.getByLabelText('学习账号／学习码'), firstAccount.accountId)
    await user.type(screen.getByLabelText('密码'), '123')
    await user.click(screen.getByRole('button', { name: '进入学习世界' }))

    await user.click(screen.getByRole('button', { name: '知识' }))
    await screen.findByRole('button', { name: /第一次 AI 实验.*当前学习/ })
    await user.click(screen.getByRole('button', { name: '阅读本章内容' }))
    await user.click(screen.getByRole('button', { name: '完成本部分知识' }))

    await user.click(screen.getByRole('button', { name: '测试' }))
    await user.click(await screen.findByRole('button', { name: '第一次 AI 实验 · 可挑战' }))
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    const quizChapter = getCourseForBand('grade5-6').quizzes.find(({ partId }) => partId === 'ael-4')
    expect(quizChapter).toBeDefined()
    const quizDialog = screen.getByRole('dialog', { name: '第一次 AI 实验答题' })
    let wrongQuestion: QuizQuestion | undefined
    let wrongOption = ''
    let correctOption = ''
    for (const [index, question] of quizChapter!.questions.entries()) {
      const selectedIndex = index === 0 ? (question.answerIndex + 1) % question.options.length : question.answerIndex
      if (index === 0) {
        wrongQuestion = question
        wrongOption = question.options[selectedIndex]
        correctOption = question.options[question.answerIndex]
      }
      await user.click(within(quizDialog).getByRole('button', { name: question.options[selectedIndex] }))
      await user.click(within(quizDialog).getByRole('button', { name: /下一题|查看成绩/ }))
    }
    expect(screen.getByText('通关成功！')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '完成' }))

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByText('错题本').closest('button')!)
    await user.click(screen.getByRole('button', { name: '重做' }))
    await user.click(screen.getByRole('button', { name: wrongOption }))
    await user.click(screen.getByRole('button', { name: correctOption }))
    await user.click(screen.getByRole('button', { name: '返回' }))

    await user.click(screen.getByRole('button', { name: '首页' }))
    await user.click(screen.getByRole('button', { name: /脑洞放映厅/ }))
    dispatchBrainFilmSave()
    expect(await screen.findByText('已保存到智芽·我的作品')).toBeInTheDocument()
    await waitFor(() => {
      expect(loadAccountState(firstAccount.accountId).learningEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'knowledge-completed', contentId: 'ael-4' }),
        expect.objectContaining({ action: 'test-passed', contentId: 'ael-4' }),
        expect.objectContaining({ action: 'correction-completed' }),
        expect.objectContaining({ action: 'work-completed' }),
      ]))
    })
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '成长画像' }))

    expect(screen.getByText('好奇探索 50 · 知识理解 62 · 问题解决 54 · 实践创造 44 · 自主规划 42'))
      .toBeInTheDocument()
    expect(screen.getByText(/把点子慢慢做出来|愿意试出新花样|让想象落到作品里/)).toBeInTheDocument()
    expect(screen.getByText('我的勋章').closest('button')).toHaveTextContent('7 / 49 枚')
    await user.click(screen.getByText('我的勋章').closest('button')!)
    expect(screen.getAllByText('已获得 · 2026-10-26')).toHaveLength(7)
    expect(screen.getByRole('button', { name: /^5—6 年级 AI 探索实验室/ })).toHaveAttribute('aria-expanded', 'true')

    const firstSaved = loadAccountState(firstAccount.accountId)
    expect(firstSaved.wrongAnswers[0]).toMatchObject({
      partId: 'ael-4',
      questionId: wrongQuestion?.id,
      selectedIndex: expect.any(Number),
      answerIndex: wrongQuestion?.answerIndex,
      correctedAt: '2026-10-26T02:00:00.000Z',
    })

    await user.click(screen.getByRole('button', { name: '返回' }))
  }, 40_000)
})
