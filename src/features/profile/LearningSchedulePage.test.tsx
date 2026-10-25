import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('LearningSchedulePage', () => {
  beforeEach(() => localStorage.clear())

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

    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    let dialog = screen.getByRole('dialog', { name: '安排学习内容' })
    await user.click(within(dialog).getByRole('button', { name: /知识：数据侦探营/ }))
    await user.selectOptions(within(dialog).getByLabelText('日期'), localDate(0))
    await user.clear(within(dialog).getByLabelText('学习时间'))
    await user.type(within(dialog).getByLabelText('学习时间'), '18:30')
    await user.click(within(dialog).getByRole('button', { name: '保存安排' }))

    const today = screen.getByRole('region', { name: `今天 ${localDate(0)}` })
    let cards = within(today).getAllByRole('listitem')
    expect(cards[0]).toHaveTextContent('第一次 AI 实验')
    expect(cards[1]).toHaveTextContent('数据侦探营')

    await user.click(within(cards[1]).getByRole('button', { name: '数据侦探营 上移' }))
    cards = within(screen.getByRole('region', { name: `今天 ${localDate(0)}` })).getAllByRole('listitem')
    expect(cards[0]).toHaveTextContent('数据侦探营')

    await user.click(within(cards[0]).getByRole('button', { name: '编辑 数据侦探营' }))
    dialog = screen.getByRole('dialog', { name: '安排学习内容' })
    await user.clear(within(dialog).getByLabelText('预计时长'))
    await user.type(within(dialog).getByLabelText('预计时长'), '25')
    await user.click(within(dialog).getByRole('button', { name: '保存安排' }))
    expect(screen.getByText('预计 25 分钟')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除 数据侦探营' }))
    expect(screen.getByText('这项安排会从计划中移除，学习进度不会改变。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(screen.queryByText('数据侦探营')).not.toBeInTheDocument()
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
})
