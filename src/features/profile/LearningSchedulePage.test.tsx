import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { LearningSchedulePage } from './LearningSchedulePage'

function localDate(offset: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function renderSchedule(onStartTask = vi.fn()) {
  return render(
    <AppStateProvider>
      <LearningSchedulePage onBack={() => undefined} onStartTask={onStartTask} />
    </AppStateProvider>,
  )
}

function mockElementFromPoint(element: Element) {
  const previous = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
  const hitTest = vi.fn(() => element)
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: hitTest,
  })
  return {
    hitTest,
    restore() {
      if (previous) Object.defineProperty(document, 'elementFromPoint', previous)
      else Reflect.deleteProperty(document, 'elementFromPoint')
    },
  }
}

describe('LearningSchedulePage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  async function addTodayCourse(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    const dialog = screen.getByRole('dialog', { name: '安排学习内容' })
    await user.click(within(dialog).getByRole('button', { name: /知识：数据侦探营/ }))
    await user.selectOptions(within(dialog).getByLabelText('日期'), localDate(0))
    await user.clear(within(dialog).getByLabelText('学习时间'))
    await user.type(within(dialog).getByLabelText('学习时间'), '18:30')
    await user.click(within(dialog).getByRole('button', { name: '保存安排' }))
  }

  it('adds a real course item to an empty day with the edited duration', async () => {
    const user = userEvent.setup()
    const onStartTask = vi.fn()
    renderSchedule(onStartTask)

    expect(screen.getByText('第一次 AI 实验')).toBeInTheDocument()
    expect(screen.getByText('给 AI 当评委')).toBeInTheDocument()
    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    await user.click(within(today).getByRole('button', { name: '开始' }))
    expect(onStartTask).toHaveBeenCalledWith(expect.objectContaining({
      partId: 'ael-4',
      kind: 'knowledge',
    }))
    await user.click(within(today).getByRole('button', { name: '第一次 AI 实验，查看学习安排' }))
    expect(onStartTask).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    const dialog = screen.getByRole('dialog', { name: '安排学习内容' })
    await user.click(within(dialog).getByRole('button', { name: /知识：AI 系统拆解站/ }))
    await user.selectOptions(within(dialog).getByLabelText('日期'), localDate(3))
    await user.clear(within(dialog).getByLabelText('预计时长'))
    await user.type(within(dialog).getByLabelText('预计时长'), '20')
    await user.click(within(dialog).getByRole('button', { name: '保存安排' }))

    expect(screen.queryByRole('dialog', { name: '安排学习内容' })).not.toBeInTheDocument()
    const targetDay = screen.getByRole('region', { name: new RegExp(localDate(3)) })
    expect(within(targetDay).getByText('AI 系统拆解站')).toBeInTheDocument()
    expect(within(targetDay).getByText('预计 20 分钟')).toBeInTheDocument()
  })

  it('edits, reorders with keyboard controls, and deletes after confirmation', async () => {
    const user = userEvent.setup()
    renderSchedule()

    await addTodayCourse(user)

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    let cards = within(today).getAllByRole('listitem')
    expect(cards[0]).toHaveTextContent('第一次 AI 实验')
    expect(cards[1]).toHaveTextContent('数据侦探营')

    await user.click(within(cards[1]).getByRole('button', { name: '数据侦探营 上移' }))
    cards = within(screen.getByRole('region', { name: `今天 ${localDate(0)}` })).getAllByRole('listitem')
    expect(cards[0]).toHaveTextContent('数据侦探营')

    await user.click(within(cards[0]).getByRole('button', { name: '编辑 数据侦探营' }))
    const dialog = screen.getByRole('dialog', { name: '安排学习内容' })
    await user.clear(within(dialog).getByLabelText('预计时长'))
    await user.type(within(dialog).getByLabelText('预计时长'), '25')
    await user.click(within(dialog).getByRole('button', { name: '保存安排' }))
    expect(screen.getByText('预计 25 分钟')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除 数据侦探营' }))
    expect(screen.getByText('这项安排会从计划中移除，学习进度不会改变。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(screen.queryByText('数据侦探营')).not.toBeInTheDocument()
  })

  it('reorders tasks by dragging within one day', async () => {
    const user = userEvent.setup()
    renderSchedule()
    await addTodayCourse(user)

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    const [firstCard, secondCard] = within(today).getAllByRole('listitem')
    const handle = within(firstCard).getByRole('button', { name: '拖动 第一次 AI 实验 排序' })

    fireEvent.dragStart(handle)
    fireEvent.dragOver(secondCard)
    fireEvent.drop(secondCard)

    const reordered = within(today).getAllByRole('listitem')
    expect(reordered[0]).toHaveTextContent('数据侦探营')
    expect(reordered[1]).toHaveTextContent('第一次 AI 实验')
  })

  it('supports touch pointer reordering through hit testing on the captured handle', async () => {
    const user = userEvent.setup()
    renderSchedule()
    await addTodayCourse(user)

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    const [firstCard, secondCard] = within(today).getAllByRole('listitem')
    const handle = within(firstCard).getByRole('button', { name: '拖动 第一次 AI 实验 排序' })
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.defineProperties(handle, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    })
    const hitTest = mockElementFromPoint(secondCard)

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 })
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 })

    const reordered = within(today).getAllByRole('listitem')
    expect(reordered[0]).toHaveTextContent('数据侦探营')
    expect(reordered[1]).toHaveTextContent('第一次 AI 实验')
    expect(setPointerCapture).toHaveBeenCalledWith(1)
    expect(releasePointerCapture).toHaveBeenCalledWith(1)
    hitTest.restore()
  })

  it('rejects a touch pointer drop on a card from another date', () => {
    renderSchedule()

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    const tomorrow = screen.getByRole('region', { name: `明天 ${localDate(1)}` })
    const sourceCard = within(today).getAllByRole('listitem')[0]
    const targetCard = within(tomorrow).getAllByRole('listitem')[0]
    const handle = within(sourceCard).getByRole('button', { name: '拖动 第一次 AI 实验 排序' })
    Object.defineProperties(handle, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    })
    const hitTest = mockElementFromPoint(targetCard)

    fireEvent.pointerDown(handle, { button: 0, pointerId: 2, pointerType: 'touch' })
    fireEvent.pointerMove(handle, { pointerId: 2, pointerType: 'touch', clientX: 30, clientY: 30 })
    fireEvent.pointerUp(handle, { pointerId: 2, pointerType: 'touch', clientX: 30, clientY: 30 })

    expect(within(today).getAllByRole('listitem')[0]).toHaveTextContent('第一次 AI 实验')
    expect(within(tomorrow).getAllByRole('listitem')[0]).toHaveTextContent(targetCard.textContent ?? '')
    hitTest.restore()
  })

  it('clears pointer capture state when a touch drag is cancelled', async () => {
    const user = userEvent.setup()
    renderSchedule()
    await addTodayCourse(user)

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    const [firstCard, secondCard] = within(today).getAllByRole('listitem')
    const handle = within(firstCard).getByRole('button', { name: '拖动 第一次 AI 实验 排序' })
    const releasePointerCapture = vi.fn()
    Object.defineProperties(handle, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    })
    const hitTest = mockElementFromPoint(secondCard)

    fireEvent.pointerDown(handle, { button: 0, pointerId: 3, pointerType: 'touch' })
    fireEvent.pointerMove(handle, { pointerId: 3, pointerType: 'touch', clientX: 40, clientY: 40 })
    fireEvent.pointerCancel(handle, { pointerId: 3, pointerType: 'touch' })
    fireEvent.pointerUp(handle, { pointerId: 3, pointerType: 'touch', clientX: 40, clientY: 40 })

    expect(within(today).getAllByRole('listitem')[0]).toHaveTextContent('第一次 AI 实验')
    expect(within(today).getAllByRole('listitem')[1]).toHaveTextContent('数据侦探营')
    expect(releasePointerCapture).toHaveBeenCalledWith(3)
    hitTest.restore()
  })

  it('does not move a task across dates when it is dropped on another day', () => {
    renderSchedule()

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    const tomorrow = screen.getByRole('region', { name: `明天 ${localDate(1)}` })
    const sourceCard = within(today).getAllByRole('listitem')[0]
    const targetCard = within(tomorrow).getAllByRole('listitem')[0]
    const targetText = targetCard.textContent
    const handle = within(sourceCard).getByRole('button', { name: '拖动 第一次 AI 实验 排序' })

    fireEvent.dragStart(handle)
    fireEvent.dragOver(targetCard)
    fireEvent.drop(targetCard)

    expect(within(today).getAllByRole('listitem')[0]).toHaveTextContent('第一次 AI 实验')
    expect(within(tomorrow).getAllByRole('listitem')[0]).toHaveTextContent(targetText ?? '')
  })

  it('shows a calm empty state for days without tasks', () => {
    renderSchedule()

    expect(screen.getAllByText('今天还没有安排，可以留作休息，也可以添加一项。').length).toBeGreaterThan(0)
  })

  it('keeps invalid durations in the editor with a gentle explanation', async () => {
    const user = userEvent.setup()
    renderSchedule()

    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    const dialog = screen.getByRole('dialog', { name: '安排学习内容' })
    await user.clear(within(dialog).getByLabelText('预计时长'))
    await user.type(within(dialog).getByLabelText('预计时长'), '4')
    await user.click(within(dialog).getByRole('button', { name: '保存安排' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('预计时长需要填写 5—90 分钟。')
    expect(dialog).toBeInTheDocument()
  })

  it('opens AI planning and writes a confirmed suggestion into the formal schedule', async () => {
    const user = userEvent.setup()
    const now = new Date().toISOString()
    const suggestedTask = {
      id: 'ai-page-suggestion',
      grade: 'grade5',
      partId: 'ael-4',
      kind: 'knowledge',
      title: '第一次 AI 实验',
      date: localDate(1),
      time: '18:30',
      minutes: 15,
      order: 0,
      source: 'ai',
      review: false,
      createdAt: now,
      updatedAt: now,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tasks: [suggestedTask],
      weekSummary: '从一次小探索开始。',
      reasons: { 'ai-page-suggestion': '先认识实验目标，再动手探索。' },
    }), { status: 200 })))
    renderSchedule()

    await user.click(screen.getByRole('button', { name: 'AI 帮我安排' }))
    expect(screen.getByRole('region', { name: 'AI 帮我安排' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))
    expect(await screen.findByRole('heading', { name: '安排预览' })).toBeInTheDocument()
    const tomorrowBefore = screen.getByRole('region', { name: `明天 ${localDate(1)}` })
    expect(within(tomorrowBefore).queryByText('第一次 AI 实验')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认采用' }))

    const tomorrow = screen.getByRole('region', { name: `明天 ${localDate(1)}` })
    expect(within(tomorrow).getByText('第一次 AI 实验')).toBeInTheDocument()
  })

  it('persists availability edited after preview before applying the AI plan', async () => {
    const user = userEvent.setup()
    const now = new Date().toISOString()
    const suggestedTask = {
      id: 'ai-availability-suggestion',
      grade: 'grade5',
      partId: 'ael-4',
      kind: 'knowledge',
      title: '第一次 AI 实验',
      date: localDate(1),
      time: '18:30',
      minutes: 15,
      order: 0,
      source: 'ai',
      review: false,
      createdAt: now,
      updatedAt: now,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tasks: [suggestedTask],
      weekSummary: '从一次小探索开始。',
      reasons: { 'ai-availability-suggestion': '先认识实验目标，再动手探索。' },
    }), { status: 200 })))
    renderSchedule()

    await user.click(screen.getByRole('button', { name: 'AI 帮我安排' }))
    await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))
    await screen.findByRole('heading', { name: '安排预览' })
    const start = screen.getByLabelText(/明天 .* 开始时间/)
    fireEvent.change(start, { target: { value: '18:00' } })
    await user.click(screen.getByRole('button', { name: '确认采用' }))

    const tomorrow = screen.getByRole('region', { name: `明天 ${localDate(1)}` })
    expect(within(tomorrow).getByText('第一次 AI 实验')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'AI 帮我安排' }))
    expect(screen.getByLabelText(/明天 .* 开始时间/)).toHaveValue('18:00')
  })
})
