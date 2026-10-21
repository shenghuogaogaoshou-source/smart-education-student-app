import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { createDefaultState } from '../../app/model'
import { ProfilePage } from './ProfilePage'
import { ProfileDetailPage } from './ProfileDetailPage'
import { ProfileEditPage } from './ProfileEditPage'

describe('profile dashboard', () => {
  it('presents the current primary grade and band without stage labels', () => {
    const view = render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('五年级 · 5—6 年级')).toBeInTheDocument()
    expect(screen.queryByText('小学端')).not.toBeInTheDocument()

    view.unmount()
    render(<AppStateProvider><ProfileDetailPage onBack={vi.fn()} onEdit={vi.fn()} /></AppStateProvider>)
    expect(screen.getByText('年级')).toBeInTheDocument()
    expect(screen.getByText('五年级 · 5—6 年级')).toBeInTheDocument()
    expect(screen.queryByText('学段')).not.toBeInTheDocument()
  })

  it('edits only primary grades without a stage selector', () => {
    render(<AppStateProvider><ProfileEditPage onBack={vi.fn()} onDone={vi.fn()} /></AppStateProvider>)

    expect(screen.queryByRole('radiogroup', { name: '选择学段' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(screen.getByRole('radio', { name: '一年级' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '六年级' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: '初一' })).not.toBeInTheDocument()
  })

  it('contains every approved profile module in the agreed order', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: '晨曦同学' })).toBeInTheDocument()
    expect(screen.getByText('本周学习')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '成长安排' })).toBeInTheDocument()
    expect(screen.getByText('我的勋章')).toBeInTheDocument()
    expect(screen.getByText('积分账户')).toBeInTheDocument()
    expect(screen.getByText('积分商城')).toBeInTheDocument()
    expect(screen.getByText('错题本')).toBeInTheDocument()
    expect(screen.getByText('AI 伙伴中心')).toBeInTheDocument()
    expect(screen.getByText('我的作品')).toBeInTheDocument()
    for (const status of ['草稿', '审核中', '已发布', '仅自己']) {
      expect(screen.getByText(status)).toBeInTheDocument()
    }
    expect(screen.getByText('第一件作品正在等你')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入设置' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '成长画像' }))
    expect(screen.getByRole('heading', { name: '近期成长足迹' })).toBeInTheDocument()
    await screen.findByLabelText('近期成长足迹五维雷达图', {}, { timeout: 10_000 })
    for (const dimension of ['好奇探索', '知识理解', '问题解决', '实践创造', '自主规划']) {
      expect(screen.getByText(dimension)).toBeInTheDocument()
    }
    expect(screen.getByText('耐心找方法的小研究员')).toBeInTheDocument()
  })

  it('previews an AI schedule suggestion before applying it', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '看看 AI 建议' }))
    expect(screen.getByRole('dialog', { name: '安排建议预览' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认调整' })).toBeInTheDocument()
  })

  it('derives the profile medal count from course progress and earned growth medals', () => {
    const state = createDefaultState()
    state.learningProgress['grade5-6'] = {
      knowledgeCompleted: ['ael-1'],
      testsPassed: ['ael-1'],
    }
    localStorage.setItem('student-app-state', JSON.stringify(state))

    render(<AppStateProvider><ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('我的勋章').closest('button')).toHaveTextContent('7 枚')
  })

  it('updates the profile-detail medal count when course and finale progress changes', () => {
    const state = createDefaultState()
    const allPartIds = [
      'ael-1', 'ael-2', 'ael-3', 'ael-4', 'ael-5',
      'ael-6', 'ael-7', 'ael-8', 'ael-9',
    ] as const
    state.learningProgress['grade5-6'] = {
      knowledgeCompleted: [...allPartIds],
      testsPassed: [...allPartIds],
    }
    localStorage.setItem('student-app-state', JSON.stringify(state))

    render(<AppStateProvider><ProfileDetailPage onBack={vi.fn()} onEdit={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('获得勋章').parentElement).toHaveTextContent('16 枚')
  })
})
