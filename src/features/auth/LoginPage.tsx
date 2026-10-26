import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, UserRound } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { BRAND } from '../../app/brand'
import { LOGIN_COMPANION_HANDOFF_KEY, LoginCompanion } from '../ai_companion/LoginCompanion'
import type { HandoffSnapshot } from '../ai_companion/CompanionHandoff'
import { AuthLayout } from './AuthLayout'
import { DEMO_ACCOUNT_ID, useSessionCredential, verifyDemoCredential } from './sessionCredential'

type LoginPageProps = {
  onNavigate: (page: 'register' | 'forgot') => void
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login, previewCompanion } = useAppState()
  const sessionCredential = useSessionCredential()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [previewLoadout, setPreviewLoadout] = useState(() => previewCompanion(''))
  const [error, setError] = useState('')
  const companionBoundsRef = useRef<DOMRect | null>(null)

  const updateCompanionBounds = useCallback((rect: DOMRect) => {
    companionBoundsRef.current = rect
  }, [])

  const captureCompanionHandoff = () => {
    const rect = companionBoundsRef.current
    const loadout = previewLoadout
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      sessionStorage.removeItem(LOGIN_COMPANION_HANDOFF_KEY)
      return
    }

    const snapshot: HandoffSnapshot & { version: 3 } = {
      version: 3,
      companionId: loadout.equipped.appearance ?? 'momo',
      loadoutVersion: loadout.version,
      startRect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      target: 'floating',
    }
    sessionStorage.setItem(LOGIN_COMPANION_HANDOFF_KEY, JSON.stringify(snapshot))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!account.trim() || !password) {
      setError('请填写学习账号和密码')
      return
    }
    if (!verifyDemoCredential(account, password)) {
      setError('学习账号或密码不正确')
      return
    }
    setError('')
    captureCompanionHandoff()
    sessionCredential.establish(DEMO_ACCOUNT_ID, password)
    login(DEMO_ACCOUNT_ID)
  }

  return (
    <AuthLayout
      title={`欢迎来到${BRAND.name}`}
      subtitle="带上好奇心，和你的 AI 成长伙伴一起发现新本领"
      companion={<LoginCompanion loadout={previewLoadout} onBoundsChange={updateCompanionBounds} />}
    >
      <form className="auth-card" onSubmit={submit}>
        <div className="field-wrap">
          <label htmlFor="login-account">学习账号／学习码</label>
          <div className="input-with-icon"><UserRound aria-hidden="true" size={19} /><input id="login-account" value={account} onChange={(event) => {
            setAccount(event.target.value)
            setPreviewLoadout(previewCompanion(event.target.value))
          }} autoComplete="username" /></div>
        </div>
        <div className="field-wrap">
          <label htmlFor="login-password">密码</label>
          <div className="input-with-icon"><KeyRound aria-hidden="true" size={19} /><input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div>
        </div>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="primary-button" type="submit">进入学习世界<ArrowRight aria-hidden="true" size={19} /></button>
      </form>
      <div className="auth-side-actions">
        <button type="button" onClick={() => onNavigate('register')}>创建学习账号</button>
        <button type="button" onClick={() => onNavigate('forgot')}>忘记密码</button>
      </div>
    </AuthLayout>
  )
}
