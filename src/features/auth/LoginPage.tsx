import { useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, UserRound } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { AuthLayout } from './AuthLayout'

type LoginPageProps = {
  onNavigate: (page: 'register' | 'forgot') => void
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { state, login } = useAppState()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!account.trim() || !password) {
      setError('请填写学习账号和密码')
      return
    }
    setError('')
    login()
  }

  return (
    <AuthLayout
      title="欢迎来到数智学习世界"
      subtitle={state.stage === 'elementary' ? '带上好奇心，一起发现 AI 的奇妙吧' : '从问题出发，探索 AI 背后的科学与创造'}
      showStageSelector
    >
      <form className="auth-card" onSubmit={submit}>
        <div className="field-wrap">
          <label htmlFor="login-account">学习账号／学习码</label>
          <div className="input-with-icon"><UserRound aria-hidden="true" size={19} /><input id="login-account" value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="username" /></div>
        </div>
        <div className="field-wrap">
          <label htmlFor="login-password">密码</label>
          <div className="input-with-icon"><KeyRound aria-hidden="true" size={19} /><input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div>
        </div>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="primary-button" type="submit">进入学习世界<ArrowRight aria-hidden="true" size={19} /></button>
        <p className="prototype-note">页面初版，不会发送或保存真实账号和密码</p>
      </form>
      <div className="auth-side-actions">
        <button type="button" onClick={() => onNavigate('register')}>创建学习账号</button>
        <button type="button" onClick={() => onNavigate('forgot')}>忘记密码</button>
      </div>
    </AuthLayout>
  )
}
