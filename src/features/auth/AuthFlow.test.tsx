import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState } from '../../app/companionAccountRepository'
import { LoginPage } from './LoginPage'
import { isGuardianConsentRequired } from './age'
import { SessionCredentialProvider } from './sessionCredential'

function renderLogin() {
  const onNavigate = vi.fn()
  render(
    <SessionCredentialProvider>
      <AppStateProvider>
        <LoginPage onNavigate={onNavigate} />
      </AppStateProvider>
    </SessionCredentialProvider>,
  )
  return { onNavigate }
}

describe('authentication flow', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('presents a single primary learning world without a stage switch or prototype disclaimer', () => {
    renderLogin()

    expect(screen.queryByRole('button', { name: '小学端' })).not.toBeInTheDocument()
    expect(screen.queryByText('页面初版，不会发送或保存真实账号和密码')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '欢迎来到智芽' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '绒桃 Momo AI 伙伴形象' })).toBeInTheDocument()
  })

  it('introduces the learning world with the 智芽 brand promise', () => {
    renderLogin()

    expect(screen.getByRole('img', { name: '智芽品牌标志' })).toBeInTheDocument()
    expect(screen.getByText('智芽')).toBeInTheDocument()
    expect(screen.getByText('小学生 AI 学习成长伙伴')).toBeInTheDocument()
    expect(screen.getByText('从好奇出发，学会思考与创造')).toBeInTheDocument()
    expect(screen.queryByText('让好奇发芽，让本领长大。')).not.toBeInTheDocument()
    expect(screen.queryByText('智芽 · AI 学习成长伙伴')).not.toBeInTheDocument()
    expect(screen.queryByText('小学一至六年级')).not.toBeInTheDocument()
  })

  it('requires both account and password without persisting credentials', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: '进入学习世界' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请填写学习账号和密码')

    await user.type(screen.getByLabelText('学习账号／学习码'), 'xiaoyu')
    await user.type(screen.getByLabelText('密码'), 'demo-pass')
    await user.click(screen.getByRole('button', { name: '进入学习世界' }))

    expect(loadAccountState('xiaoyu').isLoggedIn).toBe(true)
    expect(JSON.stringify(localStorage)).not.toContain('demo-pass')
  })

  it('captures the equipped companion bounds immediately before a successful login', async () => {
    const boundsSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 72,
      left: 40,
      top: 72,
      right: 220,
      bottom: 252,
      width: 180,
      height: 180,
      toJSON: () => ({}),
    } as DOMRect)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('学习账号／学习码'), 'demo-2026')
    await user.type(screen.getByLabelText('密码'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: '进入学习世界' }))

    expect(JSON.parse(sessionStorage.getItem('student-app-login-companion-bounds') ?? '{}')).toEqual({
      version: 3,
      companionId: 'momo',
      loadoutVersion: 1,
      startRect: { left: 40, top: 72, right: 220, bottom: 252, width: 180, height: 180 },
      target: 'floating',
    })
    boundsSpy.mockRestore()
  })

  it('routes learners younger than fourteen to guardian consent', () => {
    expect(
      isGuardianConsentRequired('2015-08-25', new Date('2026-08-24')),
    ).toBe(true)
    expect(
      isGuardianConsentRequired('2010-08-24', new Date('2026-08-24')),
    ).toBe(false)
  })
})
