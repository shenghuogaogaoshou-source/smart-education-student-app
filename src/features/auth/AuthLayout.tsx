import type { PropsWithChildren, ReactNode } from 'react'
import { GraduationCap, Rocket } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import './auth.css'

type AuthLayoutProps = PropsWithChildren<{
  title: string
  subtitle: string
  backAction?: ReactNode
  showStageSelector?: boolean
}>

export function AuthLayout({ title, subtitle, backAction, showStageSelector = false, children }: AuthLayoutProps) {
  const { state, setStage } = useAppState()
  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <section className="auth-shell">
        {showStageSelector && (
          <div className="stage-switch" aria-label="选择学习端">
            <button type="button" aria-pressed={state.stage === 'elementary'} onClick={() => setStage('elementary')}>
              <Rocket aria-hidden="true" size={18} />小学端
            </button>
            <button type="button" aria-pressed={state.stage === 'secondary'} onClick={() => setStage('secondary')}>
              <GraduationCap aria-hidden="true" size={18} />中学端
            </button>
          </div>
        )}
        {backAction}
        <header className="auth-heading">
          <p className="brand-kicker">智趣数智学堂</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
      </section>
    </main>
  )
}
