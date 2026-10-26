import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('student app integration', () => {
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
    await user.type(screen.getByLabelText('学习账号／学习码'), 'demo-student')
    await user.type(screen.getByLabelText('密码'), 'demo-password')
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
    await user.type(screen.getByLabelText('学习账号／学习码'), 'chenxi_2026')
    await user.type(screen.getByLabelText('密码'), 'demo-password')
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
})
