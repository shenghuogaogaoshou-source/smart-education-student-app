import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { ProfilePage } from './ProfilePage'

describe('profile dashboard', () => {
  it('contains every approved profile module in the agreed order', async () => {
    const user = userEvent.setup()
    render(
      <AppStateProvider>
        <ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} />
      </AppStateProvider>,
    )

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
    expect(screen.getByText('会分类的照相机')).toBeInTheDocument()
    expect(screen.getByText('未来校园小设计')).toBeInTheDocument()
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
    render(
      <AppStateProvider>
        <ProfilePage onOpenSettings={vi.fn()} onOpenProfileDetail={vi.fn()} />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '看看 AI 建议' }))
    expect(screen.getByRole('dialog', { name: '安排建议预览' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认调整' })).toBeInTheDocument()
  })
})
