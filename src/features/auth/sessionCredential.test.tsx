import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useState, type PropsWithChildren } from 'react'
import { AppStateProvider, useAppState } from '../../app/AppState'
import {
  DEMO_ACCOUNT_ID,
  SessionCredentialProvider,
  useSessionCredential,
  verifyDemoCredential,
} from './sessionCredential'

function wrapper({ children }: PropsWithChildren) {
  return <SessionCredentialProvider>{children}</SessionCredentialProvider>
}

function LogoutHarness() {
  const { logout } = useAppState()
  const credential = useSessionCredential()
  const [verified, setVerified] = useState(false)
  return (
    <div>
      <output aria-label="verified">{String(verified)}</output>
      <button type="button" onClick={() => credential.establish('xiaoyu', 'demo-pass')}>建立凭证</button>
      <button type="button" onClick={() => setVerified(credential.verify('demo-pass'))}>验证凭证</button>
      <button type="button" onClick={logout}>退出登录</button>
    </div>
  )
}

describe('session credential', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('accepts only the fixed 123 / 123 demonstration credential', () => {
    expect(DEMO_ACCOUNT_ID).toBe('123')
    expect(verifyDemoCredential('123', '123')).toBe(true)
    expect(verifyDemoCredential(' 123 ', '123')).toBe(true)
    expect(verifyDemoCredential('chenxi_2026', '123')).toBe(false)
    expect(verifyDemoCredential('123', 'wrong-pass')).toBe(false)
  })

  it('verifies only the current in-memory account password and clears it', () => {
    const { result } = renderHook(() => useSessionCredential(), { wrapper })

    act(() => result.current.establish('xiaoyu', 'demo-pass'))
    expect(result.current.verify('demo-pass')).toBe(true)
    expect(result.current.verify('wrong-pass')).toBe(false)

    act(() => result.current.clear())
    expect(result.current.verify('demo-pass')).toBe(false)
  })

  it('never writes the password to browser persistence', () => {
    const { result } = renderHook(() => useSessionCredential(), { wrapper })

    act(() => result.current.establish('xiaoyu', 'demo-pass'))

    expect(JSON.stringify(localStorage)).not.toContain('demo-pass')
    expect(JSON.stringify(sessionStorage)).not.toContain('demo-pass')
  })

  it('clears the in-memory password when the learner logs out', async () => {
    const user = userEvent.setup()
    render(
      <SessionCredentialProvider>
        <AppStateProvider><LogoutHarness /></AppStateProvider>
      </SessionCredentialProvider>,
    )

    await user.click(screen.getByRole('button', { name: '建立凭证' }))
    await user.click(screen.getByRole('button', { name: '验证凭证' }))
    expect(screen.getByLabelText('verified')).toHaveTextContent('true')

    await user.click(screen.getByRole('button', { name: '退出登录' }))
    await user.click(screen.getByRole('button', { name: '验证凭证' }))
    expect(screen.getByLabelText('verified')).toHaveTextContent('false')
  })
})
