import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { WrongBookPage } from './WrongBookPage'

describe('wrong book', () => {
  beforeEach(() => localStorage.clear())

  it('shows real quiz questions instead of unrelated subject exercises', () => {
    render(<AppStateProvider><WrongBookPage onBack={() => undefined} /></AppStateProvider>)

    expect(screen.getByText('一次完整的小实验通常包含什么？')).toBeInTheDocument()
    expect(screen.getByText('数据质量会影响什么？')).toBeInTheDocument()
    expect(screen.queryByText('一个三角形的底边为 12cm，高为 8cm，求其面积。')).not.toBeInTheDocument()
  })

  it('reveals the chosen wrong option and the actual quiz answer', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><WrongBookPage onBack={() => undefined} /></AppStateProvider>)

    await user.click(screen.getByText('一次完整的小实验通常包含什么？'))

    expect(screen.getByText('只采一张照片')).toBeInTheDocument()
    expect(screen.getByText('采集、训练、测试和改进')).toBeInTheDocument()
  })
})
