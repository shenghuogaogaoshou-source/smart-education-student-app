import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { HistoryPage } from './HistoryPage'

describe('learning history', () => {
  it('lists knowledge and test titles from the current course', () => {
    render(<AppStateProvider><HistoryPage onBack={() => undefined} /></AppStateProvider>)

    expect(screen.getByText('AI 探索实验室')).toBeInTheDocument()
    expect(screen.getAllByText('AI 系统拆解站').length).toBeGreaterThan(0)
    expect(screen.getAllByText('数据侦探营').length).toBeGreaterThan(0)
    for (const repeatedTitle of ['算法工具箱', '从点子到产品', '我的 AI 小项目']) {
      expect(screen.getAllByText(repeatedTitle).length).toBeGreaterThanOrEqual(2)
    }
    expect(screen.queryByText('未来城市 · 插画创作')).not.toBeInTheDocument()
    expect(screen.queryByText('"神经网络" 知识卡片')).not.toBeInTheDocument()
  })
})
