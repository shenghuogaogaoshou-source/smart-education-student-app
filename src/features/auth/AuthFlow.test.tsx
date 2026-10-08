import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { LoginPage } from './LoginPage'
import { isGuardianConsentRequired } from './age'

function renderLogin() {
  const onNavigate = vi.fn()
  render(
    <AppStateProvider>
      <LoginPage onNavigate={onNavigate} />
    </AppStateProvider>,
  )
  return { onNavigate }
}

describe('authentication flow', () => {
  it('switches the learning stage before login', async () => {
    const user = userEvent.setup()
    renderLogin()

    expect(screen.getByRole('button', { name: '小学端' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '中学端' }))

    expect(document.documentElement.dataset.stage).toBe('secondary')
  })

  it('requires both account and password without persisting credentials', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: '进入学习世界' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请填写学习账号和密码')

    await user.type(screen.getByLabelText('学习账号／学习码'), 'demo-2026')
    await user.type(screen.getByLabelText('密码'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: '进入学习世界' }))

    expect(localStorage.getItem('student-app-state')).not.toContain('secret-pass')
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
