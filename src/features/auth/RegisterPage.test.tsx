import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState } from '../../app/companionAccountRepository'
import { defaultState } from '../../app/model'
import { RegisterPage } from './RegisterPage'

function renderRegisterPage() {
  const onBack = vi.fn()
  const onGuardianRequired = vi.fn()
  render(
    <AppStateProvider>
      <RegisterPage onBack={onBack} onGuardianRequired={onGuardianRequired} />
    </AppStateProvider>,
  )
  return { onGuardianRequired }
}

describe('registration birth date', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('offers only grades one through six during registration', () => {
    renderRegisterPage()

    const options = within(screen.getByLabelText('选择年级')).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['请选择年级', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'])
  })

  it('keeps the login-only brand block out of the registration page', () => {
    renderRegisterPage()

    expect(screen.queryByLabelText('智芽学习成长空间')).not.toBeInTheDocument()
  })

  it('groups the year, month, and day fields into one readable date card', () => {
    renderRegisterPage()

    expect(screen.getByRole('group', { name: '出生日期输入' })).toBeInTheDocument()
  })

  it('starts the birth date fields at the registration date instead of the minimum year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00'))

    renderRegisterPage()

    expect(screen.getByLabelText('出生年')).toHaveValue(2026)
    expect(screen.getByLabelText('出生月')).toHaveValue(10)
    expect(screen.getByLabelText('出生日')).toHaveValue(15)
  })

  it('does not show the removed learning-content explanation', () => {
    renderRegisterPage()

    expect(screen.queryByText('用于匹配适合你的学习内容')).not.toBeInTheDocument()
  })

  it('uses a manually entered birth date for the existing guardian check', async () => {
    const user = userEvent.setup()
    const { onGuardianRequired } = renderRegisterPage()

    await user.clear(screen.getByLabelText('出生年'))
    await user.clear(screen.getByLabelText('出生月'))
    await user.clear(screen.getByLabelText('出生日'))
    await user.type(screen.getByLabelText('出生年'), '2015')
    await user.type(screen.getByLabelText('出生月'), '8')
    await user.type(screen.getByLabelText('出生日'), '25')
    await user.selectOptions(screen.getByLabelText('选择年级'), 'grade1')
    await user.type(screen.getByLabelText('学习账号／学习码'), 'learning-demo')
    await user.type(screen.getByLabelText('手机号／邮箱'), 'demo@example.com')
    await user.type(screen.getByRole('textbox', { name: /验证码/ }), '123456')
    await user.type(screen.getByLabelText('设置密码'), 'demo-password')
    await user.click(screen.getByRole('button', { name: '检查并继续' }))

    expect(onGuardianRequired).toHaveBeenCalledOnce()
    await waitFor(() => expect(loadAccountState(defaultState.accountId).grade).toBe('grade1'))
  })

  it('synchronizes a date picked in the calendar into the numeric fields', async () => {
    const user = userEvent.setup()
    renderRegisterPage()
    const today = new Date()

    await user.click(screen.getByRole('button', { name: '打开日期选择器' }))
    expect(screen.getByRole('dialog', { name: '选择出生日期' })).toBeInTheDocument()
    expect(screen.getByLabelText('选择年份')).toHaveValue(String(today.getFullYear()))

    await user.click(screen.getByRole('button', { name: `${today.getFullYear()}年${today.getMonth() + 1}月1日` }))

    expect(screen.getByLabelText('出生年')).toHaveValue(today.getFullYear())
    expect(screen.getByLabelText('出生月')).toHaveValue(today.getMonth() + 1)
    expect(screen.getByLabelText('出生日')).toHaveValue(1)
  })

  it('opens the calendar as an inline panel so it does not cover later form fields', async () => {
    const user = userEvent.setup()
    renderRegisterPage()

    await user.click(screen.getByRole('button', { name: '打开日期选择器' }))

    expect(screen.getByRole('dialog', { name: '选择出生日期' })).toHaveClass('birth-calendar-inline')
  })

  it('opens the year selector at the registration year instead of the earliest year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-04-15T08:00:00'))
    renderRegisterPage()

    fireEvent.click(screen.getByRole('button', { name: '打开日期选择器' }))

    expect(screen.getByLabelText('选择年份')).toHaveValue('2027')
  })
})
